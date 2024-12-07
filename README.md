# DDS Backend

This is the backend for our DDS project, ResAuc as part of the ECS 265 course in fall 2024. It provides APIs for managing the application's data and integrates with MongoDB 
for data storage.

## Features
- RESTful API endpoints for CRUD operations.
- MongoDB integration for database management.
- Designed to run specifically on **port 3000**.

---

## Prerequisites
Make sure you have the following installed on your system:
- [Node.js](https://nodejs.org/) (v16 or later)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [MongoDB](https://www.mongodb.com/try/download/community) (running locally or accessible via a connection URI)

---
## Installation and Setup

1. **Clone the Repository**
   git clone https://github.com/himanshu-nimonkar/dds-backend-main.git
   cd dds-backend-main
2. **Install Dependencies**
   npm install
3. **Set Up Environment Variables**
   Create a .env file in the project root and configure the following:
   MONGO_URI=<your_mongo_connection_string>
   PORT=3000
4. **Start the Server**
   npm start
