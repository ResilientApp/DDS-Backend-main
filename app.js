const express = require('express');
const bcrypt = require('bcrypt');
const User = require('./User');

const router = express.Router();

// User registration route
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send('Username already taken');
    }

    const newUser = new User({ username, password });
    await newUser.save();

    res.send('Registration successful!');
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).send('Error during registration');
  }
});

// User Login Route
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).send('Invalid username');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).send('Invalid password');
    }

    res.status(200).json(user);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Error during login');
  }
});

// Posting a new listing route
router.post('/new-listing', async (req, res) => {
  const { title, description, minBidValue, username, imageBase64 } = req.body;

  if (!title || !description || !minBidValue || !username || !imageBase64) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const newListing = {
      title,
      description,
      minBidValue: parseInt(minBidValue),
      image: imageBase64, 
    };

    user.listings.push(newListing);
    await user.save();

    const createdListing = user.listings[user.listings.length - 1];

    res.status(200).json(createdListing);
  } catch (err) {
    console.error('Error creating listing:', err);
    res.status(500).json({ message: 'Error creating listing' });
  }
});



// Retreives all active listings on the website
router.get('/all-listings', async (req, res) => {
  try {
    const users = await User.find();

    const allListings = users.reduce((acc, user) => {
      return acc.concat(user.listings); 
    }, []);

    res.json(allListings);
  } catch (err) {
    console.error('Error retrieving listings:', err);
    res.status(500).send('Error retrieving listings');
  }
});

// Route all active listings for a specific user
router.get('/my-listings', async (req, res) => {
  const { username } = req.query;  

  if (!username) {
    return res.status(400).send('Username is required');
  }

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).send('User not found');
    }

    res.json(user.listings);  
  } catch (err) {
    console.error('Error retrieving user listings:', err);
    res.status(500).send('Error retrieving listings');
  }
});

// Delete a listing route
router.delete('/delete-listing', async (req, res) => {
  const { username, listingId } = req.body;  

  if (!username || !listingId) {
    return res.status(400).send('Username and listingId are required');
  }

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).send('User not found');
    }

    const listingIndex = user.listings.findIndex(listing => listing._id.toString() === listingId);

    if (listingIndex === -1) {
      return res.status(404).send('Listing not found');
    }

    user.listings.splice(listingIndex, 1);

    await user.save();

    res.send('Listing deleted successfully');
  } catch (err) {
    console.error('Error deleting listing:', err);
    res.status(500).send('Error deleting listing');
  }
});

// Route to post a bid
router.post('/post-bid', async (req, res) => {
  const { username, listingId, bidValue } = req.body;  

  if (!username || !listingId || !bidValue) {
    return res.status(400).send('Username, listingId, and bidValue are required');
  }

  try {
    const userWithListing = await User.findOne({ 'listings._id': listingId });

    if (!userWithListing) {
      return res.status(404).send('Listing not found');
    }

    const listing = userWithListing.listings.id(listingId);

    if (!listing) {
      return res.status(404).send('Listing not found');
    }

    if (userWithListing.username === username) {
      return res.status(403).send('You cannot bid on your own listing');
    }

    if (listing.bids.length === 0) {
      if (bidValue < listing.minBidValue) {
        return res.status(400).send(`First bid must be greater than the minimum bid value of ${listing.minBidValue}`);
      }
    } else {
    const highestBid = listing.bids.reduce((maxBid, currentBid) => {
      return currentBid.bidValue > maxBid.bidValue ? currentBid : maxBid;
    }, { bidValue: 0 });

    if (bidValue <= highestBid.bidValue) {
      return res.status(400).send(`Bid value must be higher than the current highest bid of ${highestBid.bidValue}`);
    }
    }

    const newBid = {
      bidValue: Number(bidValue),
      username: String(username)
    };

    listing.bids.push(newBid);

    const validationError = userWithListing.validateSync();
    if (validationError) {
      console.error('Validation Error:', validationError);
      return res.status(400).send(`Validation Error: ${validationError.message}`);
    }

    await userWithListing.save();

    res.send('Bid placed successfully');
  } catch (err) {
    console.error('Error placing bid:', err);
    res.status(500).send('Error placing bid');
  }
});

// Selling an item route
router.post('/sell-item', async (req, res) => {
  const { sellerUsername, listingId } = req.body;

  if (!sellerUsername || !listingId) {
    return res.status(400).send('Seller username and listingId are required');
  }

  try {
    const seller = await User.findOne({ username: sellerUsername });
    if (!seller) {
      return res.status(404).send('Seller not found');
    }

    const listing = seller.listings.id(listingId);
    if (!listing) {
      return res.status(404).send('Listing not found for this seller');
    }

    if (listing.bids.length === 0) {
      return res.status(400).send('No bids available for this listing');
    }

    const highestBid = listing.bids.reduce((max, bid) => (bid.bidValue > max.bidValue ? bid : max), listing.bids[0]);

    listing.sold = true; 
    listing.soldTo = highestBid.username; 
    listing.soldPrice = highestBid.bidValue; 

    await seller.save();

    res.status(200).json({
      message: 'Item sold successfully',
      listingId: listingId,
      soldTo: highestBid.username,
      soldPrice: highestBid.bidValue
    });
  } catch (err) {
    console.error('Error selling item:', err);
    res.status(500).send('Error selling item');
  }
});

// Route to get all items bought by a specific user
router.get('/bought-by-me', async (req, res) => {
  const { username } = req.query; 

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const users = await User.find();

    if (!users || users.length === 0) {
      return res.status(200).json([]);
    }


    const boughtListings = users.flatMap(user => 
      user.listings.filter(listing => listing.soldTo === username)
    );

    res.status(200).json(boughtListings);
  } catch (err) {
    console.error('Error retrieving bought items:', err);
    res.status(500).json({ error: 'Error retrieving bought items' });
  }
});




// Route to get all items sold by a specific user
router.get('/sold-by-me', async (req, res) => {
  const { username } = req.query; 

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const soldListings = user.listings.filter(listing => listing.sold);
    res.status(200).json(soldListings);
  } catch (err) {
    console.error('Error retrieving sold items:', err);
    res.status(500).json({ error: 'Error retrieving sold items' });
  }
});

// Export routes
module.exports = router;
