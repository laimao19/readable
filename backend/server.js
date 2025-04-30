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
        //setting the tier for simplifier
        await axios.post(`${SIMPLIFIER_SERVICE_URL}/set-tier`, { tier: readingLevel });
        //simplifying the text
        const simplifyResponse = await axios.post(`${SIMPLIFIER_SERVICE_URL}/simplify`, { text: original_text });
        //checking if simplified text is returned
        if (simplifyResponse.data && simplifyResponse.data.simplified_text) {
          simplified_text = simplifyResponse.data.simplified_text;
          simplification_type = `simplified-${readingLevel}`;
          console.log(`Simplification successful.`);
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

//basic error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

//listening on port 3001
app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
}); 