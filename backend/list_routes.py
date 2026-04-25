from main import app
for route in app.routes:
    print(f"{list(route.methods)} {route.path}")
