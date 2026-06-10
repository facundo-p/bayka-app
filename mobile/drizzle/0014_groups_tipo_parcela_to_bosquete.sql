-- Renombra el tipo de grupo legacy 'parcela' -> 'bosquete' (issue #69).
-- El backend ya removió 'parcela' del CHECK (mig 012, PARC-07: CHECK tipo IN
-- ('linea','bosquete')). El cliente seguía escribiendo 'parcela', lo que viola
-- el CHECK al sincronizar. Esta migración alinea las filas locales existentes.
--
-- Se marca pending_sync = true para que el tipo corregido se propague al server:
-- una fila con tipo='parcela' nunca pudo sincronizar (el server la rechaza), así
-- que necesariamente está pendiente; forzar el flag es seguro e idempotente.
UPDATE `groups` SET `tipo` = 'bosquete', `pending_sync` = true WHERE `tipo` = 'parcela';
