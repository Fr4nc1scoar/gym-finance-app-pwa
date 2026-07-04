const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Esta función se ejecuta todos los días a las 8:00 AM usando Cloud Scheduler
exports.checkMembershipsAndNotify = functions.pubsub.schedule("0 8 * * *").timeZone("America/Caracas").onRun(async (context) => {
  const db = admin.firestore();
  const today = new Date();
  
  // Obtenemos todos los clientes cuya membresía expira pronto o ya expiró
  const clientsSnapshot = await db.collection("clients").get();
  
  const tokensToNotify = [];
  
  clientsSnapshot.forEach((doc) => {
    const client = doc.data();
    if (!client.dueDate || !client.fcmToken) return;

    const dueDate = new Date(client.dueDate);
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Vence mañana
      tokensToNotify.push({
        token: client.fcmToken,
        title: "¡Mensualidad por vencer!",
        body: `Hola, la mensualidad de ${client.name} se vence mañana.`
      });
    } else if (diffDays === 0) {
      // Vence hoy
      tokensToNotify.push({
        token: client.fcmToken,
        title: "¡Mensualidad vencida!",
        body: `Hola, la mensualidad de ${client.name} se vence HOY.`
      });
    } else if (diffDays < 0 && diffDays > -3) {
      // Expirada hace 1 o 2 días
      tokensToNotify.push({
        token: client.fcmToken,
        title: "Pago atrasado",
        body: `La mensualidad de ${client.name} está vencida desde hace ${Math.abs(diffDays)} días.`
      });
    }
  });

  if (tokensToNotify.length === 0) {
    console.log("No hay notificaciones pendientes.");
    return null;
  }

  // Enviar las notificaciones a los dispositivos
  const messages = tokensToNotify.map(notification => ({
    notification: {
      title: notification.title,
      body: notification.body,
    },
    token: notification.token
  }));

  try {
    const response = await admin.messaging().sendAll(messages);
    console.log(`Notificaciones enviadas exitosamente: ${response.successCount}`);
  } catch (error) {
    console.error("Error al enviar notificaciones:", error);
  }

  return null;
});
