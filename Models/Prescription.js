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
    
  proposedAmount: { type: Number, default: null },
  proposedDescription: { type: String, default: '' },
  deliveryCharge: { type: Number, default: null },
  platformFee: { type: Number, default: null },
  totalAmount: { type: Number, default: null },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  
}, { timestamps: true });

export default mongoose.model("Prescription", prescriptionSchema);
