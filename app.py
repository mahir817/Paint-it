from flask import Flask
from Landing_Page.landingpage import landing_bp

app = Flask(__name__)
app.secret_key = "supersecretkey"

# Register blueprint
app.register_blueprint(landing_bp)

if __name__ == "__main__":
    app.run(debug=True)
