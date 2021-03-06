"use strict";
const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const UserSchema = new Schema({
  email: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  metadata: Schema.Types.Mixed,
  bestFriend: Types.ObjectId,
  friends: [
    {
      uid: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      nickname: String
    }
  ],
  city: {
    coordinates: {
      type: [Number],
      index: "2dsphere"
    }
  }
});

UserSchema.virtual("name").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// method functions
UserSchema.methods = {
  isMetadataString() {
    return typeof this.metadata === "string";
  }
};

// static functions
UserSchema.statics = {
  async getFriends(friendUids) {
    return await this.aggregate([{ $match: { _id: { $in: friendUids } } }]);
  }
};

// query functions
UserSchema.query = {
  populateFriends() {
    return this.populate("friends.uid", "firstName lastName");
  }
};

module.exports = mongoose.model("User", UserSchema);
