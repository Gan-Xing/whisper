// lib/globalState.ts

import { Transcript } from "@/types";

type SendMessageFunction = (data: Transcript) => void;

let globalSendMessage: SendMessageFunction = () => {};

export const setGlobalSendMessage = (fn: SendMessageFunction) => {
  globalSendMessage = fn;
};

export const getGlobalSendMessage = () => globalSendMessage;
