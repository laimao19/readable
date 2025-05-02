from flask import Flask, request, jsonify
import os
import logging
from flask_cors import CORS 
from simplifier import NLPSimplifier
import nltk
nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('wordnet')

app = Flask(__name__)
allowed_origins = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000')
origins = [origin.strip() for origin in allowed_origins.split(',')]
CORS(app, resources={r"/*": {"origins": origins}})

logging.basicConfig(level=logging.INFO)

#initializing simplifier
base_path = os.path.dirname(os.path.abspath(__file__))
data_path = os.path.join(base_path, 'data') 
tier_files = {
    'beginner': os.path.join(data_path, 'ADV-ELE.txt'),
    'intermediate': os.path.join(data_path, 'ADV-INT.txt')
}
#do data files exist
if not os.path.exists(data_path):
    logging.warning(f"Data directory not found at {data_path}. Simplifier might fail.")
else:
    for tier, filepath in tier_files.items():
        if not os.path.exists(filepath):
            logging.warning(f"Expected data file for tier '{tier}' not found at {filepath}")

#single instance of the simplifier
try:
    beginner_path = tier_files.get('beginner')
    intermediate_path = tier_files.get('intermediate')
    simplifier_instance = NLPSimplifier(adv_ele_path=beginner_path)
    current_tier = 'intermediate' 
except Exception as e:
    logging.error(f"Failed to initialize NLPSimplifier: {e}", exc_info=True)
    simplifier_instance = None 

#POST /set-tier
@app.route('/set-tier', methods=['POST'])
def set_tier_route():
    global current_tier
    if not simplifier_instance: #if no simplifier instance return error
        return jsonify({"error": "Simplifier not initialized"}), 500
    data = request.get_json() #otherwise get the data from the request body
    if not data or 'tier' not in data: #if no data in the request body return error
        return jsonify({"error": "Missing 'tier' in request body"}), 400
    new_tier = data['tier'].lower() #get tier from the request body
    if new_tier not in ['beginner', 'intermediate', 'advanced']: #if tier is not valid return error
        return jsonify({"error": f"Invalid tier: {new_tier}. Must be beginner, intermediate, or advanced."}), 400
    try:
        simplifier_instance.set_simplification_tier(new_tier) #set the tier
        current_tier = new_tier #keep track of the current state locally too
        return jsonify({"message": f"Tier set to {current_tier}"}), 200
    except AttributeError:
        logging.error(f"Method 'set_simplification_tier' not found on simplifier object.")
        return jsonify({"error": "Simplifier configuration error"}), 500
    except Exception as e: 
        logging.error(f"Error setting tier to {new_tier}: {e}", exc_info=True)
        return jsonify({"error": f"Failed to set tier: {e}"}), 500

#POST /simplify
@app.route('/simplify', methods=['POST'])
def simplify_route():
    if not simplifier_instance: #if no simplifier instance return error
        return jsonify({"error": "Simplifier not initialized"}), 500
    data = request.get_json() #otherwise get the data from the request body
    if not data or 'text' not in data: #if no text in the request body return error
        return jsonify({"error": "Missing 'text' in request body"}), 400
    original_text = data['text'] #get the text from the request body
    
    logging.info(f"==== Simplification Request ====")
    logging.info(f"Current tier: {current_tier}")
    logging.info(f"Original text ({len(original_text.split())} words): {original_text[:100]}...")
    
    #if the tier is advanced, return original text immediately (they don't need simplification anymore)
    if current_tier == 'advanced':
        logging.info(f"Advanced tier - no simplification applied")
        return jsonify({"original_text": original_text, "simplified_text": original_text, "tier": current_tier}), 200
    try:
        #saving original tokenized words for comparison
        original_tokens = original_text.split()
        #tracking replacements and total words checked
        simplifier_instance.replacement_count = 0
        simplifier_instance.total_words_checked = 0
        #simplifying the text
        simplified_text = simplifier_instance.simplify_text(original_text)
        evaluation = simplifier_instance.evaluate_simplification(original_text, simplified_text)
        
        # Log evaluation metrics
        logging.info("\n==== Simplification Evaluation ====")
        logging.info("Original text metrics:")
        logging.info(f"Flesch reading ease score: {evaluation['original_metrics']['flesch_reading_ease']:.2f} ({evaluation['original_metrics']['interpretation']})")
        logging.info(f"Difficult word %: {evaluation['original_metrics']['difficult_word_percent']:.2f}%")
        logging.info(f"Avg word length: {evaluation['original_metrics']['avg_word_length']:.2f}")
        logging.info(f"Avg sentence length: {evaluation['original_metrics']['avg_sentence_length']:.2f}")

        logging.info("\nSimplified text metrics:")
        logging.info(f"Flesch reading ease score: {evaluation['simplified_metrics']['flesch_reading_ease']:.2f} ({evaluation['simplified_metrics']['interpretation']})")
        logging.info(f"Difficult word %: {evaluation['simplified_metrics']['difficult_word_percent']:.2f}%")
        logging.info(f"Avg word length: {evaluation['simplified_metrics']['avg_word_length']:.2f}")
        logging.info(f"Avg sentence length: {evaluation['simplified_metrics']['avg_sentence_length']:.2f}")

        logging.info("\nImprovement:")
        logging.info(f"Flesch reading ease score: +{evaluation['flesch_reading_ease_diff']:.2f} points")
        logging.info(f"Difficult word reduction: {evaluation['difficult_word_percent_diff']:.2f}%")
        logging.info(f"Avg word length reduction: {evaluation['avg_word_length_diff']:.2f}")
        logging.info(f"Avg sentence length reduction: {evaluation['avg_sentence_length_diff']:.2f}")
        logging.info(f"Text length reduction: {evaluation['sentence_len_reduction_pct']:.2f}%")
        
        #calculating simplification stats
        replacement_count = getattr(simplifier_instance, 'replacement_count', 0)
        total_words = len(original_tokens)
        #calculating percentage of words that were simplified
        if total_words > 0:
            simplification_percent = (replacement_count / total_words) * 100
            logging.info(f"Simplification result: {replacement_count}/{total_words} words simplified ({simplification_percent:.1f}%)")
            logging.info(f"Simplified: {simplified_text[:100]}...")
        else:
            simplification_percent = 0
            logging.info("No words to simplify")
            
        # Include evaluation metrics in the response
        return jsonify({
            "original_text": original_text, 
            "simplified_text": simplified_text, 
            "tier": current_tier,
            "simplification_percent": round(simplification_percent, 1),
            "words_replaced": replacement_count,
            "total_words": total_words,
            "evaluation_metrics": {
                "original_metrics": evaluation["original_metrics"],
                "simplified_metrics": evaluation["simplified_metrics"],
                "improvement": {
                    "flesch_reading_ease_diff": evaluation["flesch_reading_ease_diff"],
                    "difficult_word_percent_diff": evaluation["difficult_word_percent_diff"],
                    "avg_word_length_diff": evaluation["avg_word_length_diff"],
                    "avg_sentence_length_diff": evaluation["avg_sentence_length_diff"],
                    "sentence_len_reduction_pct": evaluation["sentence_len_reduction_pct"]
                }
            }
        }), 200
    except Exception as e:
        logging.error(f"Failed to simplify text: {e}", exc_info=True)
        return jsonify({"error": f"Failed to simplify text: {e}"}), 500

#GET /health
@app.route('/health', methods=['GET'])
def health_check():
    status = {"status": "ok", "simplifier_initialized": simplifier_instance is not None}
    if simplifier_instance:
        status["current_tier"] = current_tier
    return jsonify(status)

#running app
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000)) 
    app.run(host='0.0.0.0', port=port, debug=True)