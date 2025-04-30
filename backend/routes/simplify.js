const express = require('express');
const axios = require('axios');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

//creating a router object for simplify routes
const router = express.Router();
//base url for the simplifier service
const SIMPLIFIER_SERVICE_URL = 'http://localhost:5000'; 
//middleware to ensure user is authenticated for these routes
router.use(ClerkExpressRequireAuth());

//POST /api/simplify/set-tier
router.post('/set-tier', async (req, res, next) => {
    //get the tier from the request body
    const { tier } = req.body;
    if (!tier) {
        return res.status(400).json({ error: "Missing 'tier' in request body" });
    }
    try {
        //forward the request to the Flask service
        const response = await axios.post(`${SIMPLIFIER_SERVICE_URL}/set-tier`, { tier });
        //send the response from the Flask service back to the frontend
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Node backend: Error forwarding set-tier request:', error.response ? error.response.data : error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response ? error.response.data : { error: 'Error communicating with simplifier service' };
        res.status(status).json(message);
    }
});

//POST /api/simplify/simplify
router.post('/simplify', async (req, res, next) => {
    //get the text from the request body
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: "Missing 'text' in request body" });
    }
    try {
        //forward the request to the Flask service
        const response = await axios.post(`${SIMPLIFIER_SERVICE_URL}/simplify`, { text });
        //send the response from the Flask service back to the frontend
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Node backend: Error forwarding simplify request:', error.response ? error.response.data : error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response ? error.response.data : { error: 'Error communicating with simplifier service' };
        res.status(status).json(message);
    }
});

module.exports = router; 