import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Pharmacy",
  },
  prescriptionUrl: {
    type: String,
  },
  notes: {
    type: String,
    default: "",
  },
    status: { type: String, default: "Pending" },  // Add status field
}, { timestamps: true });

export default mongoose.model("Prescription", prescriptionSchema);
