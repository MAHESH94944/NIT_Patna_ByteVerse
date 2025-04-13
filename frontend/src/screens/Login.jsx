import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "../config/axios";
import { UserContext } from "../context/user.context";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { setUser } = useContext(UserContext);
  const navigate = useNavigate();

  function submitHandler(e) {
    e.preventDefault();
    axios
      .post("/users/login", {
        email,
        password,
      })
      .then((res) => {
        console.log(res.data);
        localStorage.setItem("token", res.data.token);
        setUser(res.data.user);
        navigate("/");
      })
      .catch((err) => {
        console.log(err.response.data);
      });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-violet-900 to-fuchsia-900">
      <div className="bg-white/10 backdrop-blur-md p-10 rounded-2xl shadow-2xl w-full max-w-md border border-white/20 transition-all duration-300 hover:shadow-purple-500/20">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300 mb-2">
            Welcome Back
          </h2>
          <p className="text-purple-200/80">
            Sign in to continue to your account
          </p>
        </div>

        <form onSubmit={submitHandler} className="space-y-6">
          <div className="space-y-2">
            <label
              className="block text-purple-200 font-medium"
              htmlFor="email"
            >
              Email
            </label>
            <input
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              id="email"
              className="w-full p-4 rounded-xl bg-white/5 text-purple-50 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent placeholder-purple-200/30 transition-all duration-200"
              placeholder="your@email.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label
                className="block text-purple-200 font-medium"
                htmlFor="password"
              >
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-pink-300 hover:text-pink-200 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <input
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              id="password"
              className="w-full p-4 rounded-xl bg-white/5 text-purple-50 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent placeholder-purple-200/30 transition-all duration-200"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full p-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:ring-offset-2 focus:ring-offset-purple-900 transition-all duration-300 shadow-lg hover:shadow-purple-500/30"
          >
            Sign In
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-purple-200/70">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-semibold text-pink-300 hover:text-pink-200 underline underline-offset-4 decoration-pink-300/30 hover:decoration-pink-200/50 transition-all duration-200"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
