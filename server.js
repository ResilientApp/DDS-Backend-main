const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import CORS package
const app = express();

app.use(bodyParser.json({ limit: '10mb' })); 

// MongoDB connection string
const mongoURI = 'mongodb+srv://shreyaslshah:shreyasshah@cluster0.ya2to.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB using Mongoose
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('Connected to MongoDB');
})
.catch((err) => {
    console.error('MongoDB connection error:', err);
});

// Use CORS middleware
app.use(cors()); // Allow cross-origin requests

// Body parser middleware to handle incoming request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Import routes from app.js
const routes = require('./app');
app.use('/api', routes);

// Start the server
const PORT = 3000; 
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
