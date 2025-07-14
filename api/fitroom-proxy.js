// api/fitroom-proxy.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { model_url, prendas } = req.body;
  if (!model_url || !Array.isArray(prendas) || prendas.length === 0) {
    return res.status(400).json({ error: "Faltan campos: model_url, prendas (array)" });
  }
  if (prendas.length > 3) {
    return res.status(400).json({ error: "Solo se permiten hasta 3 prendas por petición" });
  }

  try {
    // Descarga la imagen del modelo
    const modelRes = await fetch(model_url);
    const modelBuffer = await modelRes.arrayBuffer();

    // Descarga las imágenes de las prendas
    const clothBuffers = await Promise.all(
      prendas.map(async (p) => {
        const res = await fetch(p.cloth_url);
        return await res.arrayBuffer();
      })
    );

    // Prepara el form-data para FitRoom
    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).slice(2);
    const formParts = [];

    // model_image
    formParts.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model_image"; filename="model.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`)
    );
    formParts.push(Buffer.from(modelBuffer));
    formParts.push(Buffer.from("\r\n"));

    // Añadir hasta 3 prendas
    for (let i = 0; i < prendas.length; i++) {
      const idx = i + 1;
      formParts.push(
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="cloth_image_${idx}"; filename="cloth${idx}.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`)
      );
      formParts.push(Buffer.from(clothBuffers[i]));
      formParts.push(Buffer.from("\r\n"));
      formParts.push(
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="cloth_type_${idx}"\r\n\r\n${prendas[i].cloth_type}\r\n`)
      );
    }
    // End
    formParts.push(Buffer.from(`--${boundary}--\r\n`));
    const formData = Buffer.concat(formParts);

    // Headers para FitRoom
    const fitroomHeaders = {
      "Authorization": "Bearer aad413904bd84c96ac4c04aaa3ae57ed304571f1ab1c18028c0b2c183a8b751a9",
      "X-API-KEY": "aad413904bd84c96ac4c04aaa3ae57ed304571f1ab1c18028c0b2c183a8b751a9",
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    };

    // Llama a FitRoom
    const fitroomRes = await fetch("https://platform.fitroom.app/api/tryon/v2/tasks", {
      method: "POST",
      headers: fitroomHeaders,
      body: formData,
    });

    const fitroomJson = await fitroomRes.json();
    if (!fitroomRes.ok) {
      console.error("FitRoom error:", fitroomJson);
      return res.status(fitroomRes.status).json(fitroomJson);
    }
    return res.status(200).json(fitroomJson);
  } catch (e) {
    console.error("Proxy error:", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Error desconocido" });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};