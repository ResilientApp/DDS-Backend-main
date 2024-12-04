const express = require('express');
const bcrypt = require('bcrypt');
const User = require('./User');

const router = express.Router();

// Registration route - handle user registration
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if the username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).send('Username already taken');
    }

    // Create a new user with password
    const newUser = new User({ username, password });
    await newUser.save();

    res.send('Registration successful!');
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).send('Error during registration');
  }
});

// Login route - handle login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).send('Invalid username');
    }

    // Compare password with the stored hashed password
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

// Route to post a new listing
router.post('/new-listing', async (req, res) => {
  const { title, description, minBidValue, username, imageBase64 } = req.body;

  // Validate input
  if (!title || !description || !minBidValue || !username || !imageBase64) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create a new listing
    const newListing = {
      title,
      description,
      minBidValue: parseInt(minBidValue),
      image: imageBase64, // Store Base64 string directly
    };

    // Add the listing to the user's profile and save
    user.listings.push(newListing);
    await user.save();

    // Retrieve the newly created listing (last element of the listings array)
    const createdListing = user.listings[user.listings.length - 1];

    res.status(200).json(createdListing);
  } catch (err) {
    console.error('Error creating listing:', err);
    res.status(500).json({ message: 'Error creating listing' });
  }
});



// Route to get all listings from all users
router.get('/all-listings', async (req, res) => {
  try {
    // Retrieve all users from the database
    const users = await User.find();

    // Extract all listings from all users
    const allListings = users.reduce((acc, user) => {
      return acc.concat(user.listings); // Concatenate each user's listings to the accumulator
    }, []);

    // Return the array of all listings
    res.json(allListings);
  } catch (err) {
    console.error('Error retrieving listings:', err);
    res.status(500).send('Error retrieving listings');
  }
});

// Route to get all listings for a specific user based on their username
router.get('/my-listings', async (req, res) => {
  const { username } = req.query;  // Get username from query parameters

  if (!username) {
    return res.status(400).send('Username is required');
  }

  try {
    // Find the user by their username
    const user = await User.findOne({ username });

    // If no user is found, return an error message
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Return the user's listings
    res.json(user.listings);  // Send the array of listings
  } catch (err) {
    console.error('Error retrieving user listings:', err);
    res.status(500).send('Error retrieving listings');
  }
});

// Route to delete a listing
router.delete('/delete-listing', async (req, res) => {
  const { username, listingId } = req.body;  // Get username and listingId from the request body

  if (!username || !listingId) {
    return res.status(400).send('Username and listingId are required');
  }

  try {
    // Find the user by their username
    const user = await User.findOne({ username });

    // If no user is found, return an error
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Find the index of the listing to delete using the MongoDB _id field
    const listingIndex = user.listings.findIndex(listing => listing._id.toString() === listingId);

    // If the listing doesn't exist, return an error
    if (listingIndex === -1) {
      return res.status(404).send('Listing not found');
    }

    // Remove the listing from the listings array
    user.listings.splice(listingIndex, 1);

    // Save the updated user document
    await user.save();

    // Send a success message
    res.send('Listing deleted successfully');
  } catch (err) {
    console.error('Error deleting listing:', err);
    res.status(500).send('Error deleting listing');
  }
});

//Route to post a bid
router.post('/post-bid', async (req, res) => {
  const { username, listingId, bidValue } = req.body;  // Get username, listingId, and bidValue from the request body

  if (!username || !listingId || !bidValue) {
    return res.status(400).send('Username, listingId, and bidValue are required');
  }

  try {
    // Find the user who owns the listing
    const userWithListing = await User.findOne({ 'listings._id': listingId });

    if (!userWithListing) {
      return res.status(404).send('Listing not found');
    }

    // Locate the specific listing within that user's listings array
    const listing = userWithListing.listings.id(listingId);

    // If no listing is found, return an error
    if (!listing) {
      return res.status(404).send('Listing not found');
    }

    // Check if the user attempting to bid is the owner of the listing
    if (userWithListing.username === username) {
      return res.status(403).send('You cannot bid on your own listing');
    }

    // Check if the bid is greater than the minBidValue if it's the first bid
    if (listing.bids.length === 0) {
      // If this is the first bid, it must be greater than the minimum bid value
      if (bidValue < listing.minBidValue) {
        return res.status(400).send(`First bid must be greater than the minimum bid value of ${listing.minBidValue}`);
      }
    } else {
    // Otherwise ensure the bid is greater than the current highest bid
    const highestBid = listing.bids.reduce((maxBid, currentBid) => {
      return currentBid.bidValue > maxBid.bidValue ? currentBid : maxBid;
    }, { bidValue: 0 });

    // Ensure the new bid is greater than the current highest bid
    if (bidValue <= highestBid.bidValue) {
      return res.status(400).send(`Bid value must be higher than the current highest bid of ${highestBid.bidValue}`);
    }
    }

    // Manually construct the bid as a plain object without Mongoose's _id generation
    const newBid = {
      bidValue: Number(bidValue),
      username: String(username)
    };

    // Add the bid to the listing's bids array
    listing.bids.push(newBid);

    // Run validation synchronously to catch errors before saving
    const validationError = userWithListing.validateSync();
    if (validationError) {
      console.error('Validation Error:', validationError);
      return res.status(400).send(`Validation Error: ${validationError.message}`);
    }

    // Save the updated user document
    await userWithListing.save();

    // Send a success message
    res.send('Bid placed successfully');
  } catch (err) {
    console.error('Error placing bid:', err);
    res.status(500).send('Error placing bid');
  }
});

router.post('/sell-item', async (req, res) => {
  const { sellerUsername, listingId } = req.body;

  if (!sellerUsername || !listingId) {
    return res.status(400).send('Seller username and listingId are required');
  }

  try {
    // Verify that the seller exists
    const seller = await User.findOne({ username: sellerUsername });
    if (!seller) {
      return res.status(404).send('Seller not found');
    }

    // Find listing under the seller's listings
    const listing = seller.listings.id(listingId);
    if (!listing) {
      return res.status(404).send('Listing not found for this seller');
    }

    // Check if there are bids on the listing
    if (listing.bids.length === 0) {
      return res.status(400).send('No bids available for this listing');
    }

    // find the highest bid
    const highestBid = listing.bids.reduce((max, bid) => (bid.bidValue > max.bidValue ? bid : max), listing.bids[0]);

    // Complete sale transaction
    listing.sold = true; // Add a `sold` flag to indicate the item has been sold
    listing.soldTo = highestBid.username; // Add `soldTo` field to record the buyer's username
    listing.soldPrice = highestBid.bidValue; // Record the final selling price

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
// Route to get all items bought by a specific user
router.get('/bought-by-me', async (req, res) => {
  const { username } = req.query; // Extract username from query parameters

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // Find all users with listings
    const users = await User.find();

    if (!users || users.length === 0) {
      return res.status(200).json([]);
    }


    // Iterate through all users and extract listings where soldTo matches the username
    const boughtListings = users.flatMap(user => 
      user.listings.filter(listing => listing.soldTo === username)
    );

    // Send the filtered listings back in the response
    res.status(200).json(boughtListings);
  } catch (err) {
    console.error('Error retrieving bought items:', err);
    res.status(500).json({ error: 'Error retrieving bought items' });
  }
});




// Route to get all items sold by a specific user
router.get('/sold-by-me', async (req, res) => {
  const { username } = req.query; // Extract username from query parameters

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // Find the user by username
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Extract listings where the sold flag is true
    const soldListings = user.listings.filter(listing => listing.sold);
    res.status(200).json(soldListings);
  } catch (err) {
    console.error('Error retrieving sold items:', err);
    res.status(500).json({ error: 'Error retrieving sold items' });
  }
});

// Export routes
module.exports = router;
