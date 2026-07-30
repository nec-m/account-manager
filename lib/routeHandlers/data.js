import { jsonNoStore, toAuthErrorResponse } from '../auth/http.js';
import { AuthError } from '../auth/service.js';
import { InvalidPhoneBindingError } from '../phoneAccountHistory.js';

export function createDataRouteHandlers({
  readData,
  writeData,
  authorize,
  verifyOrigin,
}) {
  return {
    async GET() {
      try {
        await authorize(['viewer', 'admin']);
        const data = await readData();
        return jsonNoStore(data);
      } catch (error) {
        if (error instanceof AuthError) return toAuthErrorResponse(error);
        return jsonNoStore({ error: 'Failed to read data' }, { status: 500 });
      }
    },

    async POST(request) {
      try {
        await authorize(['admin']);
        verifyOrigin(request);
        const newData = await request.json();
        if (!newData || !Array.isArray(newData.accounts) || !Array.isArray(newData.phones)) {
          return jsonNoStore({ error: 'Invalid data format' }, { status: 400 });
        }

        const data = await writeData(newData);
        return jsonNoStore({ success: true, data });
      } catch (error) {
        if (error instanceof AuthError) return toAuthErrorResponse(error);
        if (error instanceof InvalidPhoneBindingError) {
          return jsonNoStore({ error: error.message }, { status: 400 });
        }
        return jsonNoStore({ error: 'Failed to write data' }, { status: 500 });
      }
    },
  };
}
