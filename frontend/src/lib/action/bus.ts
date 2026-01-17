import { configs } from "./../config.env";

const BASE_URL = `/api/v1/bus`;
console.log(BASE_URL);

export const fetchBuses = async () => {
  const res = await fetch(BASE_URL, {
    credentials: "include",
  });
  return res.json();
};
