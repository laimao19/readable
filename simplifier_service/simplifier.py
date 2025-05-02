import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import wordnet as wn
import re
import difflib
import pandas as pd
from collections import defaultdict
from textstat import flesch_reading_ease
from transformers import pipeline, AutoTokenizer
import spacy
import os
import logging
import string
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')
try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet')


class NLPSimplifier:
    def __init__(self, adv_ele_path=None, subtlex_path=None):
        self.word_map = {} #word map is a dictionary that maps words to their simplified forms (not currently used)
        self.freq_dict = {} #freq_dict is a dictionary that maps words to their frequency in the corpus
        #initializing WordNet for semantic relationships
        self.semantic_keywords = self._identify_semantic_keywords() #semantic keywords
        self.antonym_dict = self._build_antonym_dict() #antonyoms
        #initializing spaCy for POS tagging and context analysis
        self.spacy_nlp = spacy.load("en_core_web_sm")
        self.user_difficulty_profile = {} #initializing user difficulty profile
        self.current_tier = "adv-ele" #initializing current tier of text being used (ADV-ELE is default)

        #defining function words to not be simplified because if we replace them, we could drastically change the meaning of the sentence
        #citation: https://semanticsimilarity.wordpress.com/function-word-lists/ (the 277 word list)
        #i did delete some words because they were really difficult in the first place
        self.function_words = {
            'a', 'about', 'above', 'across', 'after', 'afterwards', 'against', 'again', 'all', 'almost', 'alone', 'along', 'already', 'also',
            'although', 'always', 'am', 'among', 'an', 'and', 'another', 'any', 'anyhow', 'anyone', 'anything', 'anyway',
            'anywhere', 'are', 'around', 'as', 'at', 'be', 'became', 'because', 'been', 'before', 'behind', 'being', 'below', 'beside',
            'besides', 'betwen', 'beyond', 'both', 'but', 'by', 'can', 'cannot', 'could', 'dare', 'despite', 'did', 'do', 'does', 'done', 'down', 'during',
            'each', 'eg', 'either', 'else', 'elsewhere', 'enough', 'etc', 'even', 'ever', 'everyone', 'everything', 'everywhere', 'except', 'few', 'first',
            'for', 'former', 'formerly', 'from', 'further', 'had', 'has', 'have', 'he', 'hence', 'her', 'here', 
            'hereby', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'however',
            'i', 'ie', 'if', 'in', 'indeed', 'inside', 'instead', 'into', 'is', 'it', 'its', 'itself', 'last', 'least', 'less', 'lot', 'lots', 'many', 'may', 'me',
            'meanwhile', 'might', 'mine', 'more', 'moreover', 'most', 'mostly', 'much', 'must', 'my', 'myself', 'namely', 'near', 'need', 'neither', 'never',
            'nevertheless', 'next', 'no', 'nobody', 'none', 'noone', 'nor', 'not', 'nothing', 'now', 'nowhere', 'of', 'often', 'oftentimes', 'on', 'once', 'one',
            'only', 'onto', 'or', 'other', 'others', 'otherwise', 'ought', 'our', 'ours', 'ourselves', 'out', 'outside', 'over', 'per', 'perhaps', 'rather', 're',
            'same', 'second', 'shall', 'she', 'should', 'since', 'so', 'somehow', 'someone', 'something', 'sometime', 'sometimes', 'somehwere', 'still', 'such', 'than',
            'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'therefore', 'these', 'they', 'third', 'this', 'though', 'through', 'throughout', 
            'thru', 'thus', 'to', 'togehter', 'too', 'top', 'toward', 'towards', 'under', 'until', 'up', 'upon', 'us', 'used', 'very', 'was', 'we', 'well', 'were', 'what',
            'whatever', 'when', 'whenever', 'whereas', 'whether', 'which', 'while', 'who', 'whoever', 'whose', 'why', 'will', 'with', 'within', 'without', 'would', 'yes',
            'yet', 'you', 'your', 'yourself', 'yours', 'yourselves'
        }
        
        #defining patterns in words that could be difficult for dyslexic readers
        self.dyslexic_difficult_patterns = [
            'tion', 'sion', 'cial', 'tial', 'cian', 'igh', 'ough', 'augh',
            'ph', 'gh', 'rh', 'wh', 'sch', 'tch', 'qu', 'thr', 'wr', 'kn',
            'dge', 'ck', 'rr', 'll', 'mm', 'nn', 'tt', 'pp', 'cc', 'ee', 'oo'
        ]

        #initializing the fill-mask transformer model - use distilled version for lower memory
        model_name = "distilroberta-base"
        self.fill_mask = pipeline("fill-mask", model=model_name)
        self.tokenizer = AutoTokenizer.from_pretrained(model_name) 
        self.mask_token = self.tokenizer.mask_token
        self.has_transformer = True

        #making sure that the word map and frequency dictionaries are loaded
        if adv_ele_path and os.path.exists(adv_ele_path):
            self.word_map = self.build_word_map(adv_ele_path)
        if subtlex_path and os.path.exists(subtlex_path):
            self.freq_dict = self.load_frequency_dict(subtlex_path)


    #this function identifies semantic keywords to not subsitute them
    #from experience of trial and error, i noted that when these words were substituted
    #the meaning of the sentence drastically changed
    def _identify_semantic_keywords(self):
        semantic_words = set() #empty set to store the semantic words
        semantic_domains = ['change', 'quantity', 'direction', 'time', 'state'] #domains of words that are important to keep for semantic
        #for each of the domains
        for domain in semantic_domains:
            #find the synsets of the domain in wordnet
            synsets = wn.synsets(domain)
            #for each synset
            for synset in synsets:
                #add the lemma names for the synset
                #we do this because the lemma names are the most specific meanings of the domain
                for lemma in synset.lemmas():
                    semantic_words.add(lemma.name().lower())
                #add the lemma names from the hypernyms (more general concepts)
                for hypernym in synset.hypernyms():
                    for lemma in hypernym.lemmas():
                        semantic_words.add(lemma.name().lower())
        #returning the semantic words
        #filtering out very short words that might be common in many contexts
        return {word for word in semantic_words if len(word) > 2}

    #this function builds a dictionary of antonyoms to avoid substitutions with opposite
    #meanings - this is hardcoded in right now but can be improved
    def _build_antonym_dict(self):
        antonym_dict = {}
        #common adjectives and verbs that often have antonyms
        common_words = [
            'increase', 'decrease', 'rise', 'fall', 'up', 'down',
            'high', 'low', 'more', 'less', 'large', 'small',
            'big', 'small', 'positive', 'negative', 'good', 'bad',
            'start', 'stop', 'begin', 'end', 'create', 'destroy',
            'build', 'collapse', 'finally', 'already'
        ]
        
        #finding antonyms through WordNet
        for word in common_words:
            synsets = wn.synsets(word)
            for synset in synsets:
                for lemma in synset.lemmas():
                    for antonym in lemma.antonyms():
                        antonym_word = antonym.name().lower()
                        antonym_dict[lemma.name().lower()] = antonym_word
                        antonym_dict[antonym_word] = lemma.name().lower()
        return antonym_dict

    #this function checks if a word is a semantic keyword that shouldn't be susbtituted
    def is_semantic_keyword(self, word):
        word = word.lower()
        if word in self.semantic_keywords:
            return True
        #if its not in the semantic keywords we check
        #in wordnet 
        synsets = wn.synsets(word)
        if synsets:
            #check if the word has meanings related to change, quantity, direction, etc.
            for synset in synsets:
                if any(domain in synset.definition() for domain in ['change', 'quantity', 'direction', 'time']):
                    return True
        return False

    #this function finds an antonym for a word if it exists
    def find_antonym(self, word):
        word = word.lower()
        #checking if word is in antonym dictionary
        if word in self.antonym_dict:
            return self.antonym_dict[word]
        #trying to find antonyms dynamically through WordNet
        synsets = wn.synsets(word)
        for synset in synsets:
            for lemma in synset.lemmas():
                if lemma.antonyms():
                    antonym = lemma.antonyms()[0].name().lower()
                    self.antonym_dict[word] = antonym
                    self.antonym_dict[antonym] = word
                    return antonym           
        return None

    #this function load's the user's difficulty profile which is a dictionary of words and their difficulty scores
    def load_user_difficulty_profile(self, word_scores: dict):
        self.user_difficulty_profile = word_scores or {}

    #this function sets the simplification tier based on the user's diagnostic results
    def set_simplification_tier(self, tier='adv-ele'):
        #beginner -> 'adv-ele'
        #intermediate -> 'adv-int'

        tier_mapping = {
            'beginner': 'adv-ele',
            'intermediate': 'adv-int',
            'advanced': None  
        }
        file_tier = tier_mapping.get(tier.lower(), tier)
        #case where no simplification is needed (advanced level)
        if file_tier is None:
            logger.info("Setting advanced level - no simplification will be applied")
            self.word_map = {}  
            self.current_tier = 'advanced'
            return
        file_map = {
            'adv-ele': 'simplifier/data/ADV-ELE.txt',
            'adv-int': 'simplifier/data/ADV-INT.txt',
        }
        #loading the word map for the selected tier
        if file_tier in file_map and os.path.exists(file_map[file_tier]):
            logger.info(f"Loading simplifier data from {file_map[file_tier]}")
            self.word_map = self.build_word_map(file_map[file_tier])
            self.current_tier = file_tier
        else:
            logger.warning(f"Invalid or missing file for tier: {file_tier}")

    #this function gets the part of speech, tag, dependency, tense, number, and lemma of a word in a sentence
    #this is used to ensure that the replacement word has the same part of speech, tag, dependency, tense, number, and lemma
    #as the original word
    def get_pos_info(self, sentence, target_word):
        #tokenizing the sentence using spacy
        tokenized_sentence = self.spacy_nlp(sentence)
        #for each token in the tokenized sentence
        for token in tokenized_sentence:
            #checking if the token is the target word (lower cased)
            if token.text.lower() == target_word.lower():
                #if it is, then return..
                return {
                    "pos": token.pos_, #part of speech
                    "tag": token.tag_, #tag
                    "dep": token.dep_, #dependency which is the relation between the token and the head of the token
                    "tense": token.morph.get("Tense"), #tense 
                    "number": token.morph.get("Number"), #number
                    "is_proper": token.pos_ == "PROPN", #if the word is a proper noun
                    "ent_type": token.ent_type_ if token.ent_type_ else "", #entity type
                    "lemma": token.lemma_ #lemma which is the base form of the word
                }
        #if the word isn't found return None
        return None

    #this function gets a contextual replacement for a word in a sentence
    #which basically means that we take into account the context of the word in the sentence
    def get_contextual_replacement(self, sentence, word, top_k=15):
        #skip if word is a function word, too short, or if the transformer isn't available
        if word.lower() in self.function_words or len(word) <= 2 or not self.has_transformer:
            return None
        #POS info to ensure we maintain the same part of speech
        pos_info = self.get_pos_info(sentence, word)

        #skip if proper noun or entity name
        if pos_info and pos_info.get("pos") == "NOUN":
            if pos_info.get("is_proper", False) or pos_info.get("ent_type") in ["GPE", "LOC", "ORG", "PERSON"]:
                return None
            
        #skipping words with high semantic importance
        if self.is_semantic_keyword(word):
            return None

        #skipping potential antonym as replacement
        if pos_info and pos_info.get("lemma"):
            lemma = pos_info.get("lemma")
            antonym = self.find_antonym(lemma)
            if antonym and antonym in sentence.lower():
                return None
                
        #skip words that modify core semantic words
        #if the word is an adjective
        if pos_info and pos_info.get("pos") == "ADJ" and self.spacy_nlp: 
            doc = self.spacy_nlp(sentence) #tokenizing sentenece
            for token in doc: #for each token
                #if the token is the target word
                if token.text.lower() == word.lower():
                    #for each childof the token
                    for child in token.children:
                        #if the child is a noun and semantic keyword, skip
                        if child.pos_ == "NOUN" and self.is_semantic_keyword(child.text): 
                            return None
                    #if the head of the token is a noun and semantic keyword, skip
                    if token.head.pos_ == "NOUN" and self.is_semantic_keyword(token.head.text):
                        return None
                        
        #for words with more than 5 chars (instead of 6), replace aggressively
        if len(word) > 5 and word.isalpha():
            has_difficult_pattern = any(pattern in word.lower() for pattern in self.dyslexic_difficult_patterns)
                
        if self.has_transformer:
            try:
                #masking the word with the mask token
                masked = re.sub(r'\b' + re.escape(word) + r'\b', self.mask_token, sentence, count=1, flags=re.IGNORECASE)
                if self.mask_token not in masked:
                    return None
                #getting the predictions from the model
                predictions = self.fill_mask(masked, top_k=top_k)
                #filtering and ranking predictions
                for pred in predictions:
                    #getting the predicted word
                    pred_word = pred['token_str'].lower().strip()
                    #skip if it's the same word, a function word, too short, or non-alphabetic
                    if (pred_word == word.lower() or 
                        pred_word in self.function_words or 
                        len(pred_word) < 2 or 
                        not pred_word.isalpha()):
                        continue
                    #skip if the prediction is an antonym of a word in the sentence
                    antonym = self.find_antonym(pred_word)
                    if antonym and antonym in sentence.lower():
                        continue
                    #checking if it has a similar POS tag (important for context)
                    if pos_info:
                        cand_info = self.get_pos_info(sentence.replace(word, pred_word), pred_word)
                        if not cand_info:
                            continue
                        #making sure there's grammatical compatibility - be less strict
                        if pos_info['pos'] != cand_info['pos'] and pos_info['pos'] not in ["ADJ", "ADV"]: 
                            continue
                    
                    #if the length of the word is greater than 5 and it has a difficult pattern
                    if len(word) > 5 and has_difficult_pattern:
                        #and if the replacement is shorter and has less syllables
                        if len(pred_word) <= len(word) and self.count_syllables(pred_word) <= self.count_syllables(word):
                            #return the replacement
                            return pred_word
                    #checking if the replacement is actually simpler for dyslexic readers
                    if self.is_better_for_dyslexia(pred_word, word):
                        return pred_word 
            except Exception as e:
                logger.error(f"Error during contextual replacement: {e}")
        return None

    #function checks if a candidate word replacement is actually better for dyslexia
    def is_better_for_dyslexia(self, candidate, original):
        #protect proper nouns
        if original[0].isupper() and not original.isupper():
            return False
        #protect semantic keywords
        if self.is_semantic_keyword(candidate):
            return False
        #protect antonyms
        if self.find_antonym(original) == candidate.lower():
            return False
            
        #checking for difficult patterns that are problematic for dyslexia
        orig_difficult_patterns = sum(1 for pattern in self.dyslexic_difficult_patterns if pattern in original.lower())
        cand_difficult_patterns = sum(1 for pattern in self.dyslexic_difficult_patterns if pattern in candidate.lower())
        
        #if the original word has difficult patterns and the candidate has fewer or equal difficult patterns    
        if orig_difficult_patterns > 0 and cand_difficult_patterns <= orig_difficult_patterns:
            #then the candidate is better
            return True
        
        #if the word has > 6 characters and difficult patterns, accept shorter replacements
        if len(original) > 6 and orig_difficult_patterns > 0:
            if len(candidate) < len(original):
                return True
        
        #if the candidate is significantly longer than the original and the original is less than 7 characters, reject
        if len(candidate) > len(original) + 2 and len(original) < 7:
            return False
            
        #if the candidate has more syllables than the original, reject
        candidate_syllables = self.count_syllables(candidate)
        original_syllables = self.count_syllables(original)
        if candidate_syllables > original_syllables + 1: 
            return False
            
        #checking frequency data
        if candidate in self.freq_dict and original in self.freq_dict:
            #if candidate is more common or nearly as common, accept
            if self.freq_dict[candidate] > self.freq_dict[original] * 0.8: 
                return True
            #if candidate is somewhat common and shorter, accept
            if (self.freq_dict[candidate] >= self.freq_dict[original] * 0.7 and 
                len(candidate) < len(original)):
                return True
                
        #if the candidate word has fewer difficult patterns accept
        if cand_difficult_patterns < orig_difficult_patterns:
            return True
            
        #if candidate word is shorter by 1-2 characters, accept
        if 2 < len(candidate) < len(original):  
            return True
                
        #if the length of the original word is greater than 7 and the candidate is shorter, accept
        if len(original) > 7 and len(candidate) < len(original):
            return True
            
        return False
        
    #this function counts the number of syllables in a word
    #this is used to ensure that the replacement word isn't too complex
    def count_syllables(self, word):
        word = word.lower() #make the word lowercase
        #if the word is less than 3 characters it has 1 syllable
        if len(word) <= 3:
            return 1  
        #removing trailing e
        if word.endswith('e'):
            word = word[:-1]
        #counting vowel groups
        count = 0
        vowels = "aeiouy"
        prev_is_vowel = False
        #for each character in the word
        for char in word:
            #check if character is a vowel
            is_vowel = char in vowels
            #if it is a vowel and the previous character wasn't a vowel
            if is_vowel and not prev_is_vowel:
                count += 1 #incremnt count
            prev_is_vowel = is_vowel
        if count == 0:
            count = 1    
        return count

    #this function builds the word map which is a dictionary of words and their replacements
    #from the adv-ele and adv-int files (not used in the current version)
    def build_word_map(self, file_path, min_count=1):
        word_map = defaultdict(list) #dictionary of words and their replacements
        pair_counts = defaultdict(int) #dictionary of word pairs and their counts
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                pairs = content.split("*******")

                for pair in pairs:
                    lines = pair.strip().split("\n")
                    if len(lines) != 2:
                        continue

                    adv_sent, ele_sent = lines
                    adv_words = word_tokenize(adv_sent.lower())
                    ele_words = word_tokenize(ele_sent.lower())

                    sm = difflib.SequenceMatcher(None, adv_words, ele_words)
                    for tag, i1, i2, j1, j2 in sm.get_opcodes():
                        if tag == "replace" and i2 - i1 == 1 and j2 - j1 == 1:
                            adv_word = adv_words[i1]
                            ele_word = ele_words[j1]
                            if (not adv_word.isalpha() or not ele_word.isalpha() or
                                    adv_word in self.function_words or ele_word in self.function_words):
                                continue
                            if adv_word != ele_word: #if the words are not the same
                                #if the word is a semantic keyword, skip
                                if self.is_semantic_keyword(adv_word) or self.is_semantic_keyword(ele_word):
                                    continue
                                #if the words are antonyms, skip
                                if self.find_antonym(adv_word) == ele_word:
                                    continue
                                #add the word and the replacement to the word map
                                word_map[adv_word].append(ele_word)
                                pair_counts[(adv_word, ele_word)] += 1
            final_dict = {}
            for (src, tgt), count in pair_counts.items():
                if count >= min_count:
                    if src not in final_dict or count > pair_counts.get((src, final_dict[src]), 0):
                        #additional check to make sure the replacement is simpler
                        if self.is_simpler(tgt, src):
                            final_dict[src] = tgt
            return final_dict
        except Exception as e:
            logger.error(f"Error building word map: {e}")
            return {}

    #this function loads the frequency dictionary data which is a dictionary of words and their frequencies
    def load_frequency_dict(self, file_path):
        #loading the frequency dictionary data
        try:
            if file_path.endswith('.xlsx'):
                df = pd.read_excel(file_path, engine='openpyxl')
            elif file_path.endswith('.csv'):
                df = pd.read_csv(file_path)
            else:
                df = pd.read_csv(file_path)
        except Exception as e:
            logger.error(f"Error reading file: {e}")
            return {}
        word_col = None #column name for the word
        freq_col = None #column name for the frequency
        #iterating through the columns
        for col in df.columns:
            #making column names lowercase
            col_lower = col.lower()
            #if the column name contains 'word'
            if 'word' in col_lower:
                word_col = col #set the column name for the word
            #if the column name contains 'freq' or 'count' or 'lg10' make the frequency column that name column
            elif 'freq' in col_lower or 'count' in col_lower or 'lg10' in col_lower:
                freq_col = col
        if not word_col or not freq_col:
            logger.warning(f"Could not identify word and frequency columns in {file_path}")
            return {}

        freq_dict = {} #dictionary of words and their frequencies
        for _, row in df.iterrows(): #iterating through the rows
            #if the word frequency and word columns are not null
            if pd.notnull(row[word_col]) and pd.notnull(row[freq_col]):
                word = str(row[word_col]).lower() #get the word and make it lowercase
                freq = float(row[freq_col]) #get the frequency
                freq_dict[word] = freq #add the word and the frequency to the dictionary
        return freq_dict

    #this function checks if a word is simpler than another word
    #(just calls the is_better_for_dyslexia function)
    def is_simpler(self, word1, word2):
        return self.is_better_for_dyslexia(word1, word2)

    #this function checks if a word is difficult for a dyslexic reader
    def is_difficult_word(self, word):
        #the word was tagged by the user as difficult then it is
        if word.lower() in self.user_difficulty_profile:
            return True
        
        #skipping short or non-alphabetic words
        if not word.isalpha() or len(word) <= 3:
            return False
            
        #skipping function words
        if word.lower() in self.function_words:
            return False
            
        #checking for low frequency if we have frequency data
        if self.freq_dict and word.lower() in self.freq_dict:
            #if the frequency is less than 3.5 its difficult
            if self.freq_dict[word.lower()] < 3.5:
                return True
                
        #checking word length - if the length is more than 7
        #its probably difficult
        if len(word) > 7:
            return True
            
        #checking for patterns known to be difficult for dyslexic readers
        for pattern in self.dyslexic_difficult_patterns:
            if pattern in word.lower():
                return True
        return False

    #this function simplifies the text by replacing complex words with simpler altneratives
    #it also forces additional replacements to meet minimum threshold (10% by specification)
    def simplify_text(self, text, verbose=True):
        #tokenizing the text
        sentences = sent_tokenize(text)
        simplified_sentences = [] #list of simplified sentences
        self.replacement_count = 0
        self.total_words_checked = 0
        self.min_replacement_percentage = 10.0  #min replacement percentage

        for sentence in sentences: #for each sentence
            simplified = self.simplify_sentence(sentence, verbose) #simplify it
            simplified_sentences.append(simplified) #add it to the list

        #checking if we need to force more replacements to meet minimum threshold
        simplified_text = ' '.join(simplified_sentences)
        replacement_percentage = 0
        if self.total_words_checked > 0:
            replacement_percentage = (self.replacement_count / self.total_words_checked) * 100
        
        #if we didn't reach the minimum threshold, force more replacements
        if replacement_percentage < self.min_replacement_percentage and self.total_words_checked >= 10:
            simplified_text = self.force_additional_replacements(simplified_text, replacement_percentage)
        return simplified_text

    #function to force additional replacements to meet minimum threshold (10% by specification)
    def force_additional_replacements(self, text, current_percentage):
        if self.total_words_checked < 10:  #if the total amount of words is < 10, there's not enough words to process
            return text
        #calculating how many more words we need to replace
        target_count = max(int(self.total_words_checked * self.min_replacement_percentage / 100), 
                          self.replacement_count + 1)
        additional_needed = target_count - self.replacement_count
        #tokenzizng the text
        sentences = sent_tokenize(text)
        #getting all words that are candidates for replacement
        all_words = []
        for sentence in sentences:
            tokens = word_tokenize(sentence)
            for token in tokens:
                #if the word is alphabetic, longer than 4 characters, and not a function word
                if token.isalpha() and len(token) > 4 and token.lower() not in self.function_words:
                    #add the word and sentence to the list
                    all_words.append((token, sentence))
        #sorting words by complexity (length and difficult patterns)
        word_complexity = []
        for word, sentence in all_words:
            complexity = len(word) #complexity is the length of the word
            #if the word has difficult patterns add to complexity
            complexity += sum(2 for pattern in self.dyslexic_difficult_patterns if pattern in word.lower())
            #add word, sentence, and complexity to the list
            word_complexity.append((word, sentence, complexity))
        
        #sorting by complexity (highest first)
        word_complexity.sort(key=lambda x: x[2], reverse=True)
        #trying to replace additional words
        replaced_count = 0
        #for each word, sentence, and complexity 
        for word, sentence, _ in word_complexity:
            #if the number of replaced words is greater than or equal to the number of additional words needed, break
            if replaced_count >= additional_needed:
                break
            replacement = self.get_forced_replacement(sentence, word)
            if replacement and replacement != word: #if the replacement is not the same as the og word
                #replace in the text (preserve capitalization)
                if word[0].isupper() and len(replacement) > 0:
                    replacement = replacement[0].upper() + replacement[1:]
                #preserving word boundaries
                pattern = r'\b' + re.escape(word) + r'\b'
                text = re.sub(pattern, replacement, text, count=1)
                #increment replacement count
                self.replacement_count += 1
                replaced_count += 1
        return text
        
    #helper method for forcing replacements with relaxed criteria
    def get_forced_replacement(self, sentence, word):
        #skipping function words, short words
        if word.lower() in self.function_words or len(word) <= 3:
            return None
        #skipping proper nouns and entities
        pos_info = self.get_pos_info(sentence, word)
        if pos_info and (pos_info.get("is_proper", False) or pos_info.get("ent_type") in ["GPE", "LOC", "ORG", "PERSON"]):
            return None   
        #skipping semantic keywords
        if self.is_semantic_keyword(word):
            return None

        if self.has_transformer:
            try:
                masked = re.sub(r'\b' + re.escape(word) + r'\b', self.mask_token, sentence, count=1, flags=re.IGNORECASE)
                if self.mask_token not in masked:
                    return None
                predictions = self.fill_mask(masked, top_k=5) #get the top 5 predictions
                #for each prediction
                for pred in predictions:
                    #get the prediction word (lowercase and stripped)
                    pred_word = pred['token_str'].lower().strip()
                    #if the prediction word is the same as the original word or is not alphabetic or is less than 2 characters, skip
                    if pred_word == word.lower() or not pred_word.isalpha() or len(pred_word) < 2:
                        continue
                    #if the length of the prediction word is less than or equal to the length of the original word plus 1
                    #we do this because we want to make sure that the prediction word is not much longer than the original word
                    if len(pred_word) <= len(word) + 1:
                        #check if the prediction word is an antonym of the original word
                        antonym = self.find_antonym(word)
                        #if the antonym is the same as the prediction word, skip
                        if antonym and antonym == pred_word:
                            continue
                        #return the prediction word
                        return pred_word
            except Exception as e:
                logger.error(f"Error during forced replacement: {e}")
                
        #trying frequency dictionary - picking a more common word with similar length
        if self.freq_dict:
            #finding words with similar meaning but higher frequency
            candidates = []
            #for each potential word
            for potential in self.freq_dict:
                #if the length of the potential word is less than or equal to the length of the original word and is greater than 2 characters
                #and the frequency of the potential word is greater than 1.5 times the frequency of the original word
                if (len(potential) <= len(word) and 
                    len(potential) > 2 and 
                    self.freq_dict.get(potential, 0) > self.freq_dict.get(word.lower(), 0) * 1.5):
                    #add the potential word to the list and the frequency of the potential word
                    candidates.append((potential, self.freq_dict[potential]))
            #sorting by frequency (highest first)
            candidates.sort(key=lambda x: x[1], reverse=True)
            #taking top 5 candidates
            for candidate, _ in candidates[:5]:
                if candidate != word.lower():
                    return candidate
        return None

    #this function simplifies a sentence (helper function for simplify_text)
    def simplify_sentence(self, sentence, verbose=True):
        #skipping empty sentences
        if not sentence or not sentence.strip():
            return sentence
        #tracking words that should be preserved as-is
        preserve_map = {}
        #analyzing sentence with spaCy
        if self.spacy_nlp:
            tokenized_sentence = self.spacy_nlp(sentence) #tokenizing sentence
            for token in tokenized_sentence:
                #identifying proper nouns, named entities, and nouns to preserve
                if token.pos_ == "PROPN" or token.ent_type_ in ["PERSON", "GPE", "LOC", "ORG"]:
                    preserve_map[token.text] = True
                #also preserve all nouns since they carry core meaning
                elif token.pos_ == "NOUN":
                    preserve_map[token.text] = True     
        #splitting sentence into words and punctuation
        tokens = self.tokenize_with_punctuation(sentence)
        simplified_tokens = [] #list of simplified tokens
        
        #for replacements made and checked words
        replacements_made = []
        checked_words = 0
        
        #for each token
        for token in tokens:
            #preserve punctuation
            if token in string.punctuation or not token.strip():
                simplified_tokens.append(token)
                continue 
                
            #counting the words that are checked
            if token.strip() and token.isalpha():
                checked_words += 1
                if hasattr(self, 'total_words_checked'):
                    self.total_words_checked += 1
                
            #skip simplification for preserved words
            if token in preserve_map:
                simplified_tokens.append(token)
                continue
                
            #skip semantic keywords
            if self.is_semantic_keyword(token):
                simplified_tokens.append(token)
                continue
                
            #getting a contextual replacement
            replacement = self.get_contextual_replacement(sentence, token)
            if replacement and replacement != token: #if there is a replacement and it's different from the original
                #preserve capitalization
                if token[0].isupper() and len(replacement) > 0:
                    replacement = replacement[0].upper() + replacement[1:]
                simplified_tokens.append(replacement) #add the replacement to the list
                # Log the replacement
                replacements_made.append((token, replacement))
                # Track replacement count
                if hasattr(self, 'replacement_count'):
                    self.replacement_count += 1
            else:
                simplified_tokens.append(token)
                
        #re-assemble the simplified sentence
        simplified_sentence = ''.join(simplified_tokens)
        return simplified_sentence

    #this function tokenizes text while preserving punctuation and spacing
    def tokenize_with_punctuation(self, text):
        tokens = [] #list of tokens
        current_token = ""
        #for the current character in the text
        for char in text:
            #if the character is a punctuation mark
            if char in string.punctuation:
                #save the current token if not empty
                if current_token:
                    tokens.append(current_token)
                    current_token = ""
                #add the punctuation as a separate token
                tokens.append(char)
            #otherwise if the character is a space
            elif char.isspace():
                #save the current token if not empty
                if current_token:
                    tokens.append(current_token)
                    current_token = ""
                #add the space as a separate token
                tokens.append(char)
            else:
                current_token += char
        if current_token:
            tokens.append(current_token)
        return tokens

    #this function calculates the readability/difficulty metrics for text
    #used to evaluate the simplification
    def get_difficulty_metrics(self, text):
        #calculating Flesch Reading Ease
        fre = flesch_reading_ease(text)

        #counting difficult words based on frequency
        words = word_tokenize(text.lower()) #tokenizing text
        total_words = len([w for w in words if w.isalpha()]) #counting total words
        difficult_words = sum(1 for word in words if self.is_difficult_word(word)) #counting difficult words
        difficult_word_percent = (difficult_words / total_words * 100) if total_words > 0 else 0 #calculating difficult word %

        #average word length
        #calculated by summing the length of all words and dividing by the total number of words
        avg_word_length = sum(len(word) for word in words if word.isalpha()) / total_words if total_words > 0 else 0

        #average sentence length
        sentences = sent_tokenize(text)
        total_sentences = len(sentences)
        #calculated by dividing the total number of words by the total number of sentences
        avg_sentence_length = total_words / total_sentences if total_sentences > 0 else 0

        #returning the metrics
        return {
            "flesch_reading_ease": fre,
            "difficult_word_percent": difficult_word_percent,
            "avg_word_length": avg_word_length,
            "avg_sentence_length": avg_sentence_length,
            "interpretation": self.flesch_reading_ease(fre)
        }

    #this function gets the flesch reading ease score
    def flesch_reading_ease(self, score):
        if score >= 90:
            return "Very Easy - 5th grade"
        elif score >= 80:
            return "Easy - 6th grade"
        elif score >= 70:
            return "Fairly Easy - 7th grade"
        elif score >= 60:
            return "Standard - 8th-9th grade"
        elif score >= 50:
            return "Fairly Difficult - 10th-12th grade"
        elif score >= 30:
            return "Difficult - College"
        else:
            return "Very Difficult - College Graduate"

    #this function evaluates the simplification by comparing the metrics
    def evaluate_simplification(self, original, simplified):
        original_metrics = self.get_difficulty_metrics(original)
        simplified_metrics = self.get_difficulty_metrics(simplified)
        fre_diff = simplified_metrics["flesch_reading_ease"] - original_metrics["flesch_reading_ease"]
        difficult_word_percent_diff = original_metrics["difficult_word_percent"] - simplified_metrics[
            "difficult_word_percent"]
        avg_word_length_diff = original_metrics["avg_word_length"] - simplified_metrics["avg_word_length"]
        avg_sentence_length_diff = original_metrics["avg_sentence_length"] - simplified_metrics["avg_sentence_length"]
        len_reduction_pct = (len(original) - len(simplified)) / len(original) * 100 if len(original) > 0 else 0

        orig_words = word_tokenize(original)
        simp_words = word_tokenize(simplified)
        diff = list(difflib.ndiff(orig_words, simp_words))

        return {
            "original_metrics": original_metrics,
            "simplified_metrics": simplified_metrics,
            "flesch_reading_ease_diff": fre_diff,
            "difficult_word_percent_diff": difficult_word_percent_diff,
            "avg_word_length_diff": avg_word_length_diff,
            "avg_sentence_length_diff": avg_sentence_length_diff,
            "sentence_len_reduction_pct": len_reduction_pct,
            "word_diff": diff
        }

    #this function prints an evaluation of the simplification (for debugging)
    def show_evaluation(self, evaluation, verbose=True):
        print("\n original text metrics:")
        print(f"flesch reading ease score: {evaluation['original_metrics']['flesch_reading_ease']:.2f} ({evaluation['original_metrics']['interpretation']})")
        print(f"difficult word %: {evaluation['original_metrics']['difficult_word_percent']:.2f}%")
        print(f"avg word length: {evaluation['original_metrics']['avg_word_length']:.2f}")
        print(f"avg sentence length: {evaluation['original_metrics']['avg_sentence_length']:.2f}")

        print("\n simplified text metrics:")
        print(f"flesch reading ease score: {evaluation['simplified_metrics']['flesch_reading_ease']:.2f} ({evaluation['simplified_metrics']['interpretation']})")
        print(f"difficult word %: {evaluation['simplified_metrics']['difficult_word_percent']:.2f}%")
        print(f"avg word length: {evaluation['simplified_metrics']['avg_word_length']:.2f}")
        print(f"avg sentence length: {evaluation['simplified_metrics']['avg_sentence_length']:.2f}")

        print("\n improvement:")
        print(f"flesch reading ease score: +{evaluation['flesch_reading_ease_diff']:.2f} points")
        print(f"difficult word reduction: {evaluation['difficult_word_percent_diff']:.2f}%")
        print(f"avg word length reduction: {evaluation['avg_word_length_diff']:.2f}")
        print(f"avg sentence length reduction: {evaluation['avg_sentence_length_diff']:.2f}")
        print(f"text length reduction: {evaluation['sentence_len_reduction_pct']:.2f}%")

        if verbose:
            print("\n word-by-word differences:")
            for d in evaluation["word_diff"]:
                print(d)

    #this function simplifies the text and evaluates
    def simplify_and_evaluate(self, text, verbose=True):
        print("\n original:", text)
        simplified = self.simplify_text(text, verbose)
        print("simplified:", simplified)
        evaluation = self.evaluate_simplification(text, simplified)
        self.show_evaluation(evaluation, verbose)
        return simplified, evaluation
