import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import { config } from "../../config.js";
import { create, findByEmail } from "../../db/queries/users.js";
import { BadRequestError } from "../errors/badRequestError.js";
import { UnauthorizedError } from "../errors/unauthorizedError.js";

export const registerHandler: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      throw new BadRequestError("Email and password are required");
    }

    const existingUser = await findByEmail(email);

    if (existingUser) {
      throw new BadRequestError("Email is already registered");
    }

    const user = await create({ email, password });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const loginHandler: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      throw new BadRequestError("Email and password are required");
    }

    const user = await findByEmail(email);

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      config.jwtSecret,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logoutHandler: RequestHandler = (_req, res) => {
  res.status(200).json({
    message: "Logged out",
  });
};
