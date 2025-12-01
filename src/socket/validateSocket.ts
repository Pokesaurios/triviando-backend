import { ZodSchema, ZodError } from "zod";
import { Socket } from "socket.io";

type AckFn = (payload: any) => void;

export const socketValidator = (schema: ZodSchema<any>, handler: (payload: any, ack?: AckFn, socket?: Socket) => Promise<any> | any) => {
  return async function (this: Socket, payload: any, ack?: AckFn) {
    try {
      const parsed = schema.parse(payload);
      return handler.call(this, parsed, ack, this);
    } catch (err) {
      let details: any[] = [];
      if (err instanceof ZodError) {
        details = err.issues;
      } else {
        details = [{ message: (err as Error)?.message || 'Unknown error' }];
      }

      let message = Array.isArray(details) && details.length && (details[0] as any).message ? (details[0] as any).message : 'Invalid payload';
      // Map Zod generic 'Required' or missing-type to more specific messages used by the app/tests
      const first = details[0] as any;
      if ((message === 'Required' || first?.code === 'invalid_type') && Array.isArray(first?.path)) {
        const path = first.path.join('.');
        if (path === 'code') message = 'Room code required';
      }
      if (ack) return ack({ ok: false, code: 400, message, details });
      // if no ack, emit an error event
      this.emit("validation:error", { message: "Invalid payload", details });
      return;
    }
  };
};
