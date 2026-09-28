import "server-only";

export type BookingNotificationData = {
  customerName: string;
  customerPhone: string;
  serviceName?: string | null;
  bookingDate: string;
  bookingTime: string;
  status: string;
};

/** Sends a private operational notification without allowing LINE to affect booking success. */
export async function sendBookingNotification(data: BookingNotificationData): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const groupId = process.env.LINE_GROUP_ID;

  if (!token || !groupId) {
    console.warn("[LINE] booking notification skipped: server configuration is incomplete");
    return false;
  }

  const text = [
    "🔔 FLOOK BARBER",
    "มีการจองคิวใหม่",
    "",
    "👤 ลูกค้า",
    data.customerName,
    "",
    "💈 บริการ",
    data.serviceName || "ไม่ระบุ",
    "",
    "📅 วันที่",
    data.bookingDate,
    "",
    "⏰ เวลา",
    data.bookingTime,
    "",
    "📞 โทร",
    data.customerPhone,
    "",
    "สถานะ",
    data.status === "pending" ? "🟡 Pending" : data.status,
  ].join("\n");

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: groupId,
        messages: [{ type: "text", text }],
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[LINE] booking notification failed", { status: response.status });
      return false;
    }
    return true;
  } catch {
    console.error("[LINE] booking notification request failed");
    return false;
  }
}
