-- Läuft einmalig beim ersten Initialisieren des Postgres-Volumes (als Superuser).
-- Erstellt die separate Keycloak-DB und bereitet die Erato-DB vor.

-- Keycloak braucht eine eigene Datenbank in derselben Instanz.
CREATE DATABASE keycloak;

-- Erato-DB (POSTGRES_DB=erato existiert bereits) vorbereiten.
\connect erato

-- Vektor-Erweiterung für spätere semantische Suche (Phase 2).
CREATE EXTENSION IF NOT EXISTS vector;

-- App-agnostisches Branding-Schema (Tabelle legt die API beim Boot an).
CREATE SCHEMA IF NOT EXISTS branding;
