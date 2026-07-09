/**
 * Sends a notification message to Line Notify via a Google Apps Script Webhook.
 * 
 * @param message The message to send to Line Notify
 * @returns boolean indicating success or failure
 */
export const sendLineNotification = async (message: string, groupId?: string): Promise<boolean> => {
  const webhookUrl = import.meta.env.VITE_LINE_NOTIFY_WEBHOOK_URL;
  // If no specific groupId is provided, fallback to the default IT Group ID
  const targetGroupId = groupId || import.meta.env.VITE_LINE_IT_GROUP_ID;
  
  if (!webhookUrl) {
    console.warn('VITE_LINE_NOTIFY_WEBHOOK_URL is not configured.');
    return false;
  }

  if (!targetGroupId) {
    console.warn('Target Group ID is not configured. Add VITE_LINE_IT_GROUP_ID to .env');
    return false;
  }

  try {
    // Send data to Google Apps Script Webhook
    // We send as plain text (JSON.stringify) to avoid preflight CORS errors that 
    // typically occur when sending application/json to Apps Script.
    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: JSON.stringify({ 
        type: 'react',
        message: message,
        to: targetGroupId
      }),
      // Important: Do not set Content-Type to application/json, 
      // as it triggers a CORS preflight that GAS doesn't handle natively without extra setup.
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
    });

    if (response.ok) {
      return true;
    } else {
      console.error('Failed to send Line notification:', await response.text());
      return false;
    }
  } catch (error) {
    console.error('Error sending Line notification:', error);
    return false;
  }
};
