import { chatHandlers } from "./chat.handlers";
import { overviewHandlers } from "./overview.handlers";

export const handlers = [...overviewHandlers, ...chatHandlers];
