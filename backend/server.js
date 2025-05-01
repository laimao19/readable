require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const { PrismaClient } = require('@prisma/client');
const userStatsRoutes = require('./routes/userStats');
const simplifyRoutes = require('./routes/simplify'); 
const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3001; 
app.use(cors({ origin: 'http://localhost:3000' })); //allowing frontend to access backend
app.use(express.json());

//mounting the user stats routes under /api/user
app.use('/api/user', userStatsRoutes);

//mounting the simplify routes under /api/simplify 
app.use('/api/simplify', simplifyRoutes);


//route to get a daily exercise passage
app.get('/api/exercises/daily', ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId; //user id from clerk
  const minWords = parseInt(req.query.min_words || '10', 10); //min words for passage is 10
  const fs = require('fs').promises; //use promises version of fs for file reading because its async
  const path = require('path'); //use path to join file path
  const axios = require('axios'); //use axios to make requests to the simplifier service
  const SIMPLIFIER_SERVICE_URL = 'http://localhost:5000'; //ensure this is accessible
  try {
    //get user's reading level from DB
    const userStats = await prisma.userStats.findUnique({
      where: { clerkUserId: userId },
    });
    //if no user stats found return error
    if (!userStats) {
      console.warn(`No stats found for user ${userId}. Using default level.`);
      return res.status(404).json({ error: 'User stats not found. Please visit dashboard first.' });
    }
    //otherwise get user's reading level from user stats
    const readingLevel = userStats.readingLevel || 'intermediate';

    //getting source file for the reading level
    let sourceFileName = 'ADV-INT.txt'; //default for intermediate/advanced
    if (readingLevel === 'beginner') {
      sourceFileName = 'ADV-ELE.txt';
    }
    //getting path to source file
    const sourceFilePath = path.join(__dirname, 'data', sourceFileName);


    //reading file and select passage
    let fileContent = ''; //empty string to store file content
    try {
      fileContent = await fs.readFile(sourceFilePath, 'utf-8');
    } catch (readError) {
      console.error(`Error reading source file ${sourceFilePath}:`, readError);
      return res.status(500).json({ error: `Could not read source file for level ${readingLevel}` });
    }

    //parsing the file content based on its format: pairs of sentences separated by *****
    //first line is advanced version and second line is elementary or intermediate version
    const pairs = fileContent.split(/\*{5,}/).map(pair => pair.trim()).filter(pair => pair);
    //filtering pairs based on minimum word count
    const validPairs = pairs.filter(pair => {
      const lines = pair.split('\n');
      //checking if both lines exist and meet minimum word count
      return lines.length >= 2 && 
             lines[0].split(/\s+/).length >= minWords &&
             lines[1].split(/\s+/).length >= minWords;
    });
    if (validPairs.length === 0) {
      return res.status(404).json({ error: `No passage pairs found in ${sourceFileName} with at least ${minWords} words.` });
    }
    //selecting a random pair
    const randomIndex = Math.floor(Math.random() * validPairs.length);
    const selectedPair = validPairs[randomIndex];
    const lines = selectedPair.split('\n');
    //extracting original (advanced) and simplified text
    const original_text = lines[0].trim();
    const data_simplified_text = lines[1].trim();
    let simplified_text = original_text; 
    let simplification_type = 'original';
    //processing through simplifier for beginner and intermediate users
    if (readingLevel === 'beginner' || readingLevel === 'intermediate') {
      try {
        console.log(`\n===== SIMPLIFICATION PROCESS =====`);
        console.log(`User ID: ${userId} | Reading Level: ${readingLevel}`);
        console.log(`Original Text (${original_text.split(/\s+/).length} words):`);
        console.log(`"${original_text}"`);
        
        //setting the tier for simplifier
        await axios.post(`${SIMPLIFIER_SERVICE_URL}/set-tier`, { tier: readingLevel });
        console.log(`Set simplifier tier to: ${readingLevel}`);
        
        //simplifying the text
        const simplifyResponse = await axios.post(`${SIMPLIFIER_SERVICE_URL}/simplify`, { text: original_text });
        //checking if simplified text is returned
        if (simplifyResponse.data && simplifyResponse.data.simplified_text) {
          simplified_text = simplifyResponse.data.simplified_text;
          simplification_type = `simplified-${readingLevel}`;
          
          //extracting simplification stats
          const simplificationPercent = simplifyResponse.data.simplification_percent || 0;
          const wordsReplaced = simplifyResponse.data.words_replaced || 0;
          const totalWords = simplifyResponse.data.total_words || original_text.split(/\s+/).length;
          
          //logging the simplified text for reference on what the model is doing
          console.log(`\nsimplified text (${simplified_text.split(/\s+/).length} words):`);
          console.log(`"${simplified_text}"`);
          //showing difference if words were replaced
          if (wordsReplaced > 0) {
            console.log(`\nword replacements:`);
            // Compare original and simplified texts (basic implementation)
            const originalWords = original_text.split(/\s+/);
            const simplifiedWords = simplified_text.split(/\s+/);
            if (originalWords.length === simplifiedWords.length) {
              for (let i = 0; i < originalWords.length; i++) {
                if (originalWords[i] !== simplifiedWords[i]) {
                  console.log(`  "${originalWords[i]}" --> "${simplifiedWords[i]}"`);
                }
              }
            }
          }
        } else {
          return res.status(500).json({ error: 'Simplifier did not return simplified text. Returning error' });
        }
      } catch (simplifyError) {
        console.error('Error calling simplifier service:', simplifyError.response ? simplifyError.response.data : simplifyError.message);
        return res.status(500).json({ error: 'Error calling simplifier service' });
      }
    }

    //returning response with both original and simplified versions
    res.json({
      original_text: original_text,
      simplified_text: simplified_text, 
      data_simplified_text: data_simplified_text, 
      word_count: simplified_text.split(/\s+/).length,
      source: sourceFileName,
      original_difficulty: 'advanced',
      simplified_difficulty: readingLevel,
      simplification_type: simplification_type,
      primary_simplification: simplification_type.startsWith('data') ? 'data' : 'model'
    });
  } catch (error) {
    console.error(`Error fetching daily exercise for user ${userId}:`, error);
    res.status(500).json({ error: 'Failed to fetch daily exercise' });
  }
});

//route to get a daily comprehension exercise
app.get('/api/exercises/daily-comprehension', ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const fs = require('fs').promises;
  const path = require('path');

  try {
    //get user's reading level from DB
    const userStats = await prisma.userStats.findUnique({
      where: { clerkUserId: userId },
    });

    if (!userStats) {
      console.warn(`No stats found for user ${userId}. Using default level.`);
      return res.status(404).json({ error: 'User stats not found. Please visit dashboard first.' });
    }

    const readingLevel = userStats.readingLevel || 'intermediate'; //get reading level
    
    //getting list of all comprehension text files
    const textsDir = path.join(__dirname, 'data', 'comprehension-texts');
    const answersDir = path.join(__dirname, 'data', 'comprehension-answers');
    const files = await fs.readdir(textsDir); //reading all files in the texts directory
    const randomFile = files[Math.floor(Math.random() * files.length)]; //select a random file
    const textFilePath = path.join(textsDir, randomFile); //read text file
    const textContent = await fs.readFile(textFilePath, 'utf-8');
    const paragraphs = textContent.split(/\*{29,}/).map(p => p.trim()).filter(p => p); //parsing paragraphs separated by *****************************
    
    //selecting a random paragraph
    const randomParagraphIndex = Math.floor(Math.random() * paragraphs.length);
    const selectedParagraph = paragraphs[randomParagraphIndex];
    
    //parsing the paragraph to get the different difficulty levels
    const paragraphLines = selectedParagraph.split('\n').filter(line => line.trim());
    const paragraphId = paragraphLines[0].trim(); 
    let paragraphText = '';
    
    //selecting text based on user's reading level
    for (let i = 1; i < paragraphLines.length; i++) {
      const line = paragraphLines[i].trim();
      if (line.startsWith('Adv:') && readingLevel === 'advanced') {
        paragraphText = line.substring(4).trim();
        break;
      } else if (line.startsWith('Int:') && readingLevel === 'intermediate') {
        paragraphText = line.substring(4).trim();
        break;
      } else if (line.startsWith('Ele:') && readingLevel === 'beginner') {
        paragraphText = line.substring(4).trim();
        break;
      }
    }
    
    //if no matching difficulty is found, default to appropriate level
    if (!paragraphText) {
      if (readingLevel === 'beginner') {
        const eleLine = paragraphLines.find(line => line.trim().startsWith('Ele:'));
        if (eleLine) {
          paragraphText = eleLine.substring(4).trim();
        }
      } else if (readingLevel === 'intermediate') {
        const intLine = paragraphLines.find(line => line.trim().startsWith('Int:'));
        if (intLine) {
          paragraphText = intLine.substring(4).trim();
        }
      } else {
        const advLine = paragraphLines.find(line => line.trim().startsWith('Adv:'));
        if (advLine) {
          paragraphText = advLine.substring(4).trim();
        }
      }
    }
    
    //reading the answers file for this text
    const answersFilePath = path.join(answersDir, randomFile);
    const answersContent = await fs.readFile(answersFilePath, 'utf-8');
    const answersSections = answersContent.split(/\*{29,}/).map(s => s.trim()).filter(s => s);
    
    //finding the section matching our paragraph ID (P1, P2, etc.)
    const matchingSection = answersSections.find(section => {
      const lines = section.split('\n');
      return lines[0].trim() === paragraphId;
    });
    
    if (!matchingSection) {
      return res.status(404).json({ error: 'Could not find matching questions for this paragraph' });
    }
    
    //parsing the questions and answers
    const questions = [];
    const lines = matchingSection.split('\n').filter(line => line.trim());
    for (let i = 1; i < lines.length; i += 5) {
      if (i + 4 < lines.length && lines[i].startsWith('Q:')) {
        const questionObj = {
          question: lines[i].substring(2).trim(),
          options: []
        };
        
        //getting the 4 options (a, b, c, d)
        for (let j = 1; j <= 4; j++) {
          const optionLine = lines[i + j].trim();
          const optionText = optionLine.substring(2).trim();
          const optionLetter = optionLine.substring(0, 1).toUpperCase();
          questionObj.options.push({
            text: optionText,
            id: optionLetter
          });
        }
        //randomizing the options order
        for (let k = questionObj.options.length - 1; k > 0; k--) {
          const j = Math.floor(Math.random() * (k + 1));
          [questionObj.options[k], questionObj.options[j]] = [questionObj.options[j], questionObj.options[k]];
        }
        
        //correct answer is always 'A' in the original
        const correctOption = questionObj.options.find(option => option.id === 'A');
        questionObj.correctOptionIndex = questionObj.options.indexOf(correctOption);
        //reassigning letters based on new order
        questionObj.options = questionObj.options.map((option, index) => ({
          ...option,
          displayId: String.fromCharCode(65 + index) //converting to A, B, C, D
        }));
        
        questions.push(questionObj); //adding to questions array
      }
    }
    //returning the response
    res.json({
      text: paragraphText,
      questions: questions,
      paragraphId: paragraphId,
      textSource: randomFile.replace('.txt', ''),
      difficulty: readingLevel
    });
    
  } catch (error) {
    console.error(`Error fetching daily comprehension exercise for user ${userId}:`, error);
    res.status(500).json({ error: 'Failed to fetch daily comprehension exercise' });
  }
});

//basic error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

//listening on port 3001
app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
}); 