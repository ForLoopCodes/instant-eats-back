const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(
  cors({
    origin: "https://instant-eats-sandy.vercel.app", // Allow only your React app
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());

const supabaseUrl = "https://icezxcvyxkiztpgwsltn.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZXp4Y3Z5eGtpenRwZ3dzbHRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM1NDU4MTgsImV4cCI6MjA0OTEyMTgxOH0.FSOHBHFCEZf6lXrdstR-nKrSyGzvV8lfiQi1EFJtzXA";
const supabase = createClient(supabaseUrl, supabaseKey);

const getData = async (table) => {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw error;
  return data;
};

const validateTable = (table, allowedTables) => {
  if (!allowedTables.includes(table)) {
    return { valid: false, message: "Invalid table name." };
  }
  return { valid: true };
};

const handleError = (res, error, customMessage) => {
  if (error)
    return res.status(500).json({ error: customMessage || error.message });
  return null;
};

const allowedTables = [
  "addresses",
  "admins",
  "delivery_persons",
  "menu_items",
  "notifications",
  "orders",
  "payments",
  "restaurants",
  "reviews",
  "users",
];
app.get("/", (req, res) => res.send("Express on Vercel"));

app.get("/:table", async (req, res) => {
  const { table } = req.params;
  const validation = validateTable(table, allowedTables);

  if (!validation.valid)
    return res.status(400).json({ error: validation.message });

  try {
    const data = await getData(table);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  const validation = validateTable(table, allowedTables);

  if (!validation.valid)
    return res.status(400).json({ error: validation.message });

  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .single();
    if (handleError(res, error, "Error fetching record")) return;

    if (!data)
      return res.status(404).json({ error: `No record found with id: ${id}` });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/:table", async (req, res) => {
  const { table } = req.params;
  const requestBody = {
    ...req.body,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const validation = validateTable(table, allowedTables);

  if (!validation.valid)
    return res.status(400).json({ error: validation.message });

  try {
    const { data, error } = await supabase.from(table).insert([requestBody]);
    if (handleError(res, error, "Error inserting record")) return;

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  const validation = validateTable(table, allowedTables);

  if (!validation.valid)
    return res.status(400).json({ error: validation.message });

  try {
    const { data, error } = await supabase.from(table).delete().eq("id", id);
    if (handleError(res, error, "Error deleting record")) return;

    res
      .status(200)
      .json({ message: `Record with id: ${id} deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/restaurants/filter", async (req, res) => {
  const { filters = {}, pagination = {}, sort = {}, fields } = req.body;

  const limit = pagination.limit || 10;
  const page = pagination.page || 1;
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const latitude = filters.latitude;
  const longitude = filters.longitude;
  const radius = filters.radius;
  const name = filters.name || null;
  const location = filters.location || null;
  const phoneNumber = filters.phone_number || null;
  const cuisineType = filters.cuisine_type || null;
  const rating = filters.rating || null;
  const cookingTime = filters.cooking_time || null;
  const opensAt = filters.opens_at || null;
  const closesAt = filters.closes_at || null;
  const isOpen = filters.is_open || null;
  const createdAt = filters.created_at || null;
  const updatedAt = filters.updated_at || null;
  const searchQuery = filters.query || null;
  const sortColumn = sort.column || null;
  const sortOrder = sort.ascending !== undefined ? sort.ascending : true; // Default to ascending

  try {
    let query = supabase
      .rpc("get_restaurants_within_radius_v2", {
        input_latitude: latitude,
        input_longitude: longitude,
        input_radius: radius,
        input_name: name,
        input_location: location,
        input_phone_number: phoneNumber,
        input_cuisine_type: cuisineType,
        input_rating: rating,
        input_cooking_time: cookingTime,
        input_opens_at: opensAt,
        input_closes_at: closesAt,
        input_is_open: isOpen,
        input_created_at: createdAt,
        input_updated_at: updatedAt,
        input_query: searchQuery,
        input_sort_column: sortColumn,
        input_sort_order: sortOrder,
      })
      .range(start, end);

    // Add fields selection if specified
    if (fields?.length > 0) {
      query = query.select(fields.join(", "));
    }

    const { data, error, count } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    const totalPages = Math.ceil(data.length / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    res.status(200).json({
      data,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: count,
        hasNextPage: hasNextPage,
        hasPreviousPage: hasPreviousPage,
        limit: Number(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/:table/:id", async (req, res) => {
  const { table, id } = req.params;
  const updates = req.body;

  const validation = validateTable(table, allowedTables);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  try {
    console.log("Updating table:", table, "ID:", id, "Updates:", updates);

    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq("id", id);

    console.log("Supabase response:", { data, error });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({
      message: `Record with id: ${id} updated successfully`,
      data,
    });
  } catch (err) {
    console.error("Unexpected server error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/users/filter", async (req, res) => {
  const { filters, pagination } = req.body;
  const { limit = 5, page = 1 } = pagination || {};

  // Calculate the start and end for range-based pagination
  const start = (page - 1) * limit;
  const end = start + limit - 1; // The end index is inclusive, so we subtract 1.

  // Initialize the query builder for users
  let filterQuery = supabase
    .from("users")
    .select("*", { count: "exact" }) // Retrieve exact count for pagination
    .range(start, end); // Use range instead of offset

  // Dynamically apply filters from the 'filters' object
  Object.keys(filters || {}).forEach((key) => {
    if (filters[key]) {
      // Use 'ilike' for partial, case-insensitive matching for strings
      if (typeof filters[key] === "string") {
        filterQuery = filterQuery.ilike(key, `%${filters[key]}%`);
      } else {
        // For non-string fields (like numbers or dates), use eq for exact match
        filterQuery = filterQuery.eq(key, filters[key]);
      }
    }
  });

  try {
    const { data, error, count } = await filterQuery;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Calculate total pages based on the count
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: count,
        limit: Number(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/addresses/filter", async (req, res) => {
  const { filters, pagination } = req.body;
  const { limit = 5, page = 1 } = pagination || {};

  // Calculate the start and end for range-based pagination
  const start = (page - 1) * limit;
  const end = start + limit - 1; // The end index is inclusive, so we subtract 1.

  // Initialize the query builder for addresses
  let filterQuery = supabase
    .from("addresses")
    .select("*", { count: "exact" }) // Retrieve exact count for pagination
    .range(start, end); // Use range instead of offset

  // Dynamically apply filters from the 'filters' object
  Object.keys(filters || {}).forEach((key) => {
    if (filters[key]) {
      // Use 'ilike' for partial, case-insensitive matching for strings
      if (typeof filters[key] === "string") {
        filterQuery = filterQuery.ilike(key, `%${filters[key]}%`);
      } else {
        // For non-string fields (like numbers or dates), use eq for exact match
        filterQuery = filterQuery.eq(key, filters[key]);
      }
    }
  });

  try {
    const { data, error, count } = await filterQuery;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Calculate total pages based on the count
    const totalPages = Math.ceil(count / limit);

    res.status(200).json({
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: count,
        limit: Number(limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TODO:
// get restaurants by location and distance
// get restaurants by search name
// get restaurants by cooking time
// get restaurants by cuisine type
// get restaurants by rating
// limit restaurants fetch by distance
// use a search filter by multiple options

// get menu_items by search name
// get menu_items by description
// get menu_items by restaurants
// get menu_items by price
// get menu_items by is_available
// limit menu_items fetch by distance of restaurants

// get addresses by user_id

// get admins by user_id

// get delivery_person by location or distance
// get delivery_person by vehicle_type
// get delivery_person by status
// get delivery_person by rating
// limit delivery_person fetch by distance

// get notifications by user_id
// limit notification fetch

{
  // Users Table
  // sql
  // Copy code
  // CREATE TABLE users (
  //     user_id SERIAL PRIMARY KEY,
  //     first_name TEXT NOT NULL,
  //     last_name TEXT NOT NULL,
  //     email TEXT UNIQUE NOT NULL,
  //     phone_number TEXT UNIQUE,
  //     password_hash TEXT NOT NULL,
  //     profile_picture TEXT,
  //     date_of_birth DATE,
  //     role TEXT CHECK(role IN ('admin', 'customer', 'delivery_person')) NOT NULL,
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  // );
  // Addresses Table
  // sql
  // Copy code
  // CREATE TABLE addresses (
  //     id SERIAL PRIMARY KEY,
  //     user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
  //     address_line_1 TEXT NOT NULL,
  //     address_line_2 TEXT,
  //     city TEXT NOT NULL,
  //     state TEXT NOT NULL,
  //     postal_code TEXT NOT NULL,
  //     country TEXT NOT NULL,
  //     is_default BOOLEAN DEFAULT false,
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  // );
  // Admins Table
  // sql
  // Copy code
  // CREATE TABLE admins (
  //     id SERIAL PRIMARY KEY,
  //     user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  // );
  // Delivery Persons Table
  // sql
  // Copy code
  // CREATE TABLE delivery_persons (
  //     id SERIAL PRIMARY KEY,
  //     user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
  //     vehicle_type TEXT,
  //     vehicle_number TEXT,
  //     status TEXT CHECK(status IN ('available', 'busy', 'offline')),
  //     current_location TEXT,
  //     rating DECIMAL(2, 1) DEFAULT 0,
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  // );
  // Menu Items Table
  // sql
  // Copy code
  // CREATE TABLE menu_items (
  //     id SERIAL PRIMARY KEY,
  //     restaurant_id INT REFERENCES restaurants(id) ON DELETE CASCADE,
  //     name TEXT NOT NULL,
  //     description TEXT,
  //     price DECIMAL(10, 2),
  //     is_available BOOLEAN DEFAULT true,
  //     image TEXT,
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  // );
  // Restaurants Table
  // sql
  // Copy code
  // CREATE TABLE restaurants (
  //     id SERIAL PRIMARY KEY,
  //     name TEXT NOT NULL,
  //     location TEXT,
  //     phone_number TEXT,
  //     cuisine_type TEXT,
  //     rating DECIMAL(2, 1),
  //     cooking_time INT,  -- Time in minutes
  //     opens_at TIME,
  //     closes_at TIME,
  //     is_open BOOLEAN DEFAULT true,
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  // );
  // Orders Table
  // sql
  // Copy code
  // CREATE TABLE orders (
  //     id SERIAL PRIMARY KEY,
  //     user_id INT REFERENCES users(user_id),
  //     restaurant_id INT REFERENCES restaurants(id),
  //     delivery_person_id INT REFERENCES delivery_persons(id),
  //     status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'cancelled')),
  //     total_price DECIMAL(10, 2),
  //     order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //     delivery_time TIMESTAMP,
  //     delivery_notes TEXT,
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  // );
  // Payments Table
  // sql
  // Copy code
  // CREATE TABLE payments (
  //     id SERIAL PRIMARY KEY,
  //     order_id INT REFERENCES orders(id),
  //     user_id INT REFERENCES users(user_id),
  //     payment_method TEXT CHECK(payment_method IN ('credit_card', 'paypal', 'cash_on_delivery')),
  //     payment_status TEXT CHECK(payment_status IN ('pending', 'completed', 'failed')),
  //     payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //     amount DECIMAL(10, 2),
  //     transaction_id TEXT UNIQUE
  // );
  // Notifications Table
  // sql
  // Copy code
  // CREATE TABLE notifications (
  //     id SERIAL PRIMARY KEY,
  //     user_id INT REFERENCES users(user_id),
  //     message TEXT,
  //     priority TEXT CHECK(priority IN ('low', 'medium', 'high')),
  //     read_status BOOLEAN DEFAULT false,
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  // );
  // Reviews Table
  // sql
  // Copy code
  // CREATE TABLE reviews (
  //     id SERIAL PRIMARY KEY,
  //     user_id INT REFERENCES users(user_id),
  //     restaurant_id INT REFERENCES restaurants(id),
  //     item_id INT REFERENCES menu_items(id),
  //     rating INT CHECK(rating BETWEEN 1 AND 5),
  //     review_text TEXT,
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  // );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
module.exports = app;
