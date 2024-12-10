const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const listingSchema = new mongoose.Schema({
    image: { type: String, required: true }, 
    title: { type: String, required: true },
    description: { type: String, required: true },
    bids: [
        {
            bidValue: { type: Number, required: true },
            username: { type: String, required: true }
        }
    ], // Array of bid objects
    minBidValue: { type: Number, required: true },
    sold: { type: Boolean, default: false }, 
    soldTo: { type: String, default: null },        
    soldPrice: { type: Number, default: null }      
});

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },  
    listings: { type: [listingSchema], default: [] } 
});

userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
