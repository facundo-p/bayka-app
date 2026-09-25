-- Alta de parcela sin subir (#654). Solo local: quién la creó en este dispositivo
-- mientras el servidor no la tiene; null = subida o bajada por pull. Las filas
-- existentes quedan en null: no hay forma cierta de saber si subieron.
ALTER TABLE `parcelas` ADD `alta_pendiente_de` text;
