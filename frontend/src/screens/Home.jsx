import React, { useContext } from "react";
import { UserContext } from "../context/user.context";

const Home = () => {
  const { user } = userContext(UserContext);
  return <div>{JSON.stringify(user)}</div>;
};

export default Home;
