import mongoose from "mongoose";

const connectDatabase = async () => {
  try {
    const data = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ DB connected: ${data.connection.host}`);
  } catch (error) {
    console.error("❌ DB error:", error.message);
    process.exit(1);
  }
};

export default connectDatabase;