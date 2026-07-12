import CryptoJS from "crypto-js";
import AppConfig from "../config/appConfig";
import { getFormattedDate } from "./dateUtil";

// --- ขั้นตอน authen_request ---
export async function authenRequest(username) {
  const now = new Date();
  const formattedDateString = getFormattedDate(now);

  const combinedString = `${username}&${formattedDateString}`;
  console.log(combinedString);

  const authenRequestString = CryptoJS.SHA256(combinedString).toString();
  console.log(authenRequestString);

  const response = await fetch(`${AppConfig.apiBaseUri}/authen/authen_request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ authen_request: authenRequestString }),
  });

  const json = await response.json();
  console.log(json);

  return {
    isError: json.isError,
    data: json.data,
    errorMessage: json.errorMessage,
  };
}

// --- ขั้นตอน access_request ---
export async function accessRequest(username, password, authenToken) {
  const passwordEncode = CryptoJS.SHA256(password).toString();

  const combinedString = `${username}&${passwordEncode}&${authenToken}`;
  const authenSignature = CryptoJS.SHA256(combinedString).toString();

  console.log(combinedString);
  console.log(authenSignature);

  const response = await fetch(`${AppConfig.apiBaseUri}/authen/access_request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      authen_signature: authenSignature,
      authen_token: authenToken,
    }),
  });

  const json = await response.json();
  console.log(json);

  if (!json.isError) {
    localStorage.setItem("access_token", json.data.access_token);
    localStorage.setItem("username", username);
  }

  return {
    isError: json.isError,
    data: json.data,
    errorMessage: json.errorMessage,
  };
}