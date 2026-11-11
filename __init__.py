"""Flask Blueprint registration for all backend API and upload routes."""
from __future__ import annotations

from flask import Flask

from .admin_catalog import admin_catalog_bp
from .auth_users import auth_users_bp
from .catalog import catalog_bp
from .orders_crm import orders_crm_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(auth_users_bp)
    app.register_blueprint(catalog_bp)
    app.register_blueprint(admin_catalog_bp)
    app.register_blueprint(orders_crm_bp)
