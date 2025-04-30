from flask import Flask, request, jsonify
from simplifier_service.simplifier import DataDrivenTextSimplifier
import logging

#logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

#initializing simplifier
simplifier = DataDrivenTextSimplifier()

#POST simplifying text route
@app.route('/api/simplify', methods=['POST'])
def simplify_text():
    try:
        #getting request body
        data = request.json
        if not data or 'text' not in data:
            return jsonify({"error": "Missing 'text' field in request body"}), 400
        #getting text from request body
        text = data['text']
        #simplify text
        simplified = simplifier.simplify_text(text)
        #return simplified text
        return jsonify({
            "original_text": text,
            "simplified_text": simplified
        })
    except Exception as e:
        logger.error(f"Error simplifying text: {e}")
        return jsonify({"error": f"Error processing request: {str(e)}"}), 500

#POST setting simplification tier route (based on diagnostic)
@app.route('/api/simplify/set-tier', methods=['POST'])
def set_tier():
    try:
        #getting request body
        data = request.json
        if not data or 'tier' not in data:
            return jsonify({"error": "Missing 'tier' field in request body"}), 400
        #getting tier from request body
        tier = data['tier']
        valid_tiers = ['beginner', 'intermediate', 'advanced']
        #checking that tier is valid
        if tier not in valid_tiers:
            return jsonify({"error": f"Invalid tier. Must be one of {valid_tiers}"}), 400
        #setting tier
        simplifier.set_simplification_tier(tier)
        #returning tier
        return jsonify({
            "message": f"Simplification tier set to {tier}",
            "tier": tier
        })
    except Exception as e:
        logger.error(f"Error setting tier: {e}")
        return jsonify({"error": f"Error processing request: {str(e)}"}), 500

#POST evaluating simplification route
@app.route('/api/simplify/evaluate', methods=['POST'])
def evaluate_simplification():
    try:
        #getting request body
        data = request.json
        if not data or 'text' not in data:
            return jsonify({"error": "Missing 'text' field in request body"}), 400
        #getting text from request body 
        text = data['text']
        #simplifying text
        simplified = simplifier.simplify_text(text)
        #evaluating simplification
        evaluation = simplifier.evaluate_simplification(text, simplified)
        
        #format evaluation for JSON response
        formatted_eval = {
            "original_metrics": {
                "flesch_reading_ease": float(evaluation["original_metrics"]["flesch_reading_ease"]),
                "difficult_word_percent": float(evaluation["original_metrics"]["difficult_word_percent"]),
                "avg_word_length": float(evaluation["original_metrics"]["avg_word_length"]),
                "avg_sentence_length": float(evaluation["original_metrics"]["avg_sentence_length"]),
                "interpretation": evaluation["original_metrics"]["interpretation"]
            },
            "simplified_metrics": {
                "flesch_reading_ease": float(evaluation["simplified_metrics"]["flesch_reading_ease"]),
                "difficult_word_percent": float(evaluation["simplified_metrics"]["difficult_word_percent"]),
                "avg_word_length": float(evaluation["simplified_metrics"]["avg_word_length"]),
                "avg_sentence_length": float(evaluation["simplified_metrics"]["avg_sentence_length"]),
                "interpretation": evaluation["simplified_metrics"]["interpretation"]
            },
            "improvement": {
                "flesch_reading_ease_diff": float(evaluation["flesch_reading_ease_diff"]),
                "difficult_word_percent_diff": float(evaluation["difficult_word_percent_diff"]),
                "avg_word_length_diff": float(evaluation["avg_word_length_diff"]),
                "avg_sentence_length_diff": float(evaluation["avg_sentence_length_diff"]),
                "sentence_len_reduction_pct": float(evaluation["sentence_len_reduction_pct"])
            },
            "simplified_text": simplified
        }
        #returning formatted evaluation
        return jsonify(formatted_eval)
    except Exception as e:
        logger.error(f"Error evaluating simplification: {e}")
        return jsonify({"error": f"Error processing request: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True) 