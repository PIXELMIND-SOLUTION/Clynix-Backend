import cloudinary from '../config/cloudinary.js';
import Category from '../Models/Category.js';
import Service from '../Models/Service.js';
import dotenv from 'dotenv'
import mongoose from 'mongoose';

dotenv.config();



cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

export const createCategory = async (req, res) => {
  try {
    const { categoryName, image, serviceName } = req.body;

    let imageUrl = '';

    if (req.files && req.files.image) {
      const uploaded = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
        folder: 'categories',
      });
      imageUrl = uploaded.secure_url;
    } else if (image && image.startsWith('http')) {
      imageUrl = image;
    } else {
      return res.status(400).json({ message: 'Image file or valid URL is required' });
    }

    // Save only categoryName, image, and serviceName
    const newCategory = new Category({
      categoryName,
      image: imageUrl,
      serviceName,
    });

    await newCategory.save();

    // Return clean response
    return res.status(201).json({
      message: 'Category created successfully',
      category: {
        categoryName,
        image: imageUrl,
        serviceName,
      },
    });

  } catch (error) {
    console.error('Error creating category:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};




// ✅ Delete Category
export const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const category = await Category.findByIdAndDelete(categoryId);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(200).json({
      message: "Category deleted successfully",
      deletedCategory: category,
    });

  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ✅ Update Category
export const updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { categoryName, image, serviceName } = req.body;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    let imageUrl = image;

    // If file uploaded
    if (req.files && req.files.image) {
      const uploaded = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
        folder: "categories",
      });
      imageUrl = uploaded.secure_url;
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      {
        categoryName,
        image: imageUrl,
        serviceName,
      },
      { new: true, runValidators: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategory,
    });

  } catch (error) {
    console.error("Error updating category:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


export const getAllCategories = async (req, res) => {
  try {
    const { serviceName } = req.query;

    let query = {};
    if (serviceName) {
      // case-insensitive partial match using regex
      query.serviceName = { $regex: serviceName, $options: 'i' };
    }

    const categories = await Category.find(query);

    return res.status(200).json({
      message: 'Categories fetched successfully',
      total: categories.length,
      categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
