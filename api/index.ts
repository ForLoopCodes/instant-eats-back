const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
app.use(
  cors({
    // origin: "http://192.168.2.156:5173", // Allow only your React app
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// find orders function
app.post("/orders/findOrders", async (req: any, res: any) => {
  try {
    const { filters, pagination } = req.body;
    const { latitude, longitude, radius } = filters || {};
    const { page = 1, limit = 10 } = pagination || {};
    const { data, error } = await supabase.rpc("find_orders_within_area", {
      input_latitude: latitude,
      input_longitude: longitude,
      input_radius: radius,
    });
    if (error) return res.status(400).json({ error: error.message });
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / limit);
    return res.json({
      data: paginatedData,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        limit,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/acceptOrder", async (req: any, res: any) => {
  const { deliveryPersonId, orderId } = req.body;

  if (!deliveryPersonId || !orderId) {
    return res
      .status(400)
      .json({ error: "deliveryPersonId and orderId are required" });
  }

  // Check if the delivery person is available
  const { data: deliveryPerson, error: deliveryPersonError } = await supabase
    .from("delivery_persons")
    .select("status")
    .eq("id", deliveryPersonId)
    .single();

  if (deliveryPersonError) {
    return res.status(400).json({ error: deliveryPersonError.message });
  }

  if (deliveryPerson.status !== "Available") {
    return res.status(400).json({ error: "Delivery person is not available" });
  }

  // Check if the order already has a delivery person assigned
  const { data: existingOrder, error: fetchError } = await supabase
    .from("orders")
    .select("delivery_person_id")
    .eq("id", orderId)
    .single();

  if (fetchError) {
    return res.status(400).json({ error: fetchError.message });
  }

  if (existingOrder.delivery_person_id) {
    return res
      .status(400)
      .json({ error: "Order already has a delivery person assigned" });
  }

  // Update the order with the new delivery person and status
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .update({ delivery_person_id: deliveryPersonId, status: "accepted" })
    .eq("id", orderId);

  if (orderError) {
    return res.status(400).json({ error: orderError.message });
  }

  // Update the delivery person's status to 'delivery'
  const { data: updatedDeliveryPerson, error: updateDeliveryPersonError } =
    await supabase
      .from("delivery_persons")
      .update({ status: "Delivery" })
      .eq("id", deliveryPersonId);

  if (updateDeliveryPersonError) {
    return res.status(400).json({ error: updateDeliveryPersonError.message });
  }

  return res.json({
    message: "Order accepted",
    orderData,
    updatedDeliveryPerson,
  });
});

app.post("/createOrder", async (req: any, res: any) => {
  const {
    p_user_id,
    p_restaurant_id,
    p_delivery_address_id,
    p_total_price,
    p_delivery_notes,
    p_items,
  } = req.body;

  if (
    !p_user_id ||
    !p_restaurant_id ||
    !p_delivery_address_id ||
    !p_total_price ||
    !p_items
  ) {
    return res.status(400).json({ error: "All order details are required" });
  }

  try {
    // Fetch restaurant location
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("latitude, longitude")
      .eq("id", p_restaurant_id)
      .single();

    if (restaurantError) {
      throw restaurantError;
    }

    const { latitude, longitude } = restaurant;

    // Insert new order
    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: p_user_id,
        restaurant_id: p_restaurant_id,
        delivery_address_id: p_delivery_address_id,
        total_price: p_total_price,
        delivery_notes: p_delivery_notes,
        items: p_items,
        created_at: new Date(),
        updated_at: new Date(),
        latitude: latitude,
        longitude: longitude,
        payment_method: "CASH",
        payment_status: "INITIALIZED",
        transaction_id: null,
      })
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    return res.json({
      message: "Order created successfully",
      order: newOrder,
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

const getData = async (table: any) => {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw error;
  return data;
};

const validateTable = (table: any, allowedTables: string | any[]) => {
  if (!allowedTables.includes(table)) {
    return { valid: false, message: "Invalid table name." };
  }
  return { valid: true };
};

const handleError = (
  res: {
    status: (arg0: number) => {
      (): any;
      new (): any;
      json: { (arg0: { error: any }): any; new (): any };
    };
  },
  error: { message: any },
  customMessage: string
) => {
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
  "restaurants",
  "reviews",
  "users",
];
app.get("/", (req: any, res: { send: (arg0: string) => any }) =>
  res.send("Express on Vercel")
);

app.get(
  "/:table",
  async (
    req: { params: { table: any } },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: { (arg0: { error: any }): void; new (): any };
      };
      json: (arg0: any) => void;
    }
  ) => {
    const { table } = req.params;
    const validation = validateTable(table, allowedTables);

    if (!validation.valid)
      return res.status(400).json({ error: validation.message });

    try {
      const data = await getData(table);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.get(
  "/:table/:id",
  async (
    req: { params: { table: any; id: any } },
    res: { status: any; json?: any }
  ) => {
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
        return res
          .status(404)
          .json({ error: `No record found with id: ${id}` });

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  "/:table",
  async (req: { params: { table: any }; body: any }, res: { status: any }) => {
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.delete(
  "/:table/:id",
  async (req: { params: { table: any; id: any } }, res: { status: any }) => {
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  "/:table/:id",
  async (
    req: { params: { table: any; id: any }; body: any },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: {
          (arg0: { error?: any; message?: string; data?: any }): void;
          new (): any;
        };
      };
    }
  ) => {
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
    } catch (err: any) {
      console.error("Unexpected server error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// FILTER FUNCTIONS
app.post("/restaurants/filter", async (req: any, res: any) => {
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
  const id = filters.id || null;
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
        input_id: id,
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/menu_items/filter", async (req: any, res: any) => {
  const { filters = {}, pagination = {}, sort = {}, fields } = req.body;

  const limit = pagination.limit || 10;
  const page = pagination.page || 1;
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const id = filters.id || null;
  const restaurantId = filters.restaurant_id || null;
  const name = filters.name || null;
  const price = filters.price || null;
  const isAvailable = filters.is_available || null;
  const rating = filters.rating || null;
  const cookingTime = filters.cooking_time || null;
  const createdAt = filters.created_at || null;
  const updatedAt = filters.updated_at || null;
  const sortColumn = sort.column || "id"; // Default sort column
  const sortOrder = sort.ascending !== undefined ? sort.ascending : true; // Default to ascending

  try {
    let query = supabase
      .rpc("get_menu_items_from_restaurants", {
        input_id: id,
        input_restaurant_id: restaurantId,
        input_name: name,
        input_price: price,
        input_is_available: isAvailable,
        input_rating: rating,
        input_cooking_time: cookingTime,
        input_created_at: createdAt,
        input_updated_at: updatedAt,
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
    const totalPages = Math.ceil(count / limit);
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/users/filter",
  async (
    req: { body: { filters: any; pagination: any } },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: {
          (arg0: {
            error?: any;
            data?: any;
            pagination?: {
              currentPage: any;
              totalPages: number;
              totalItems: any;
              limit: number;
            };
          }): void;
          new (): any;
        };
      };
    }
  ) => {
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.post(
  "/addresses/filter",
  async (
    req: { body: { filters: any; pagination: any } },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        json: {
          (arg0: {
            error?: any;
            data?: any;
            pagination?: {
              currentPage: any;
              totalPages: number;
              totalItems: any;
              limit: number;
            };
          }): void;
          new (): any;
        };
      };
    }
  ) => {
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
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

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
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server running on http://localhost:${PORT}`);
// });

//host to local network on 192.168
const PORT = process.env.PORT || 3000;
const HOST = "localhost"; // Replace with your actual local network IP

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
module.exports = app;
