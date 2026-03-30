import http.server
import socketserver
import json
import os

PORT = 8000

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data)
            
            filename = payload.get('filename')
            data = payload.get('data')
            
            if filename in ['movies.json', 'series.json']:
                try:
                    # Use absolute path to ensure we write to the correct directory
                    base_dir = os.path.dirname(os.path.abspath(__file__))
                    file_path = os.path.join(base_dir, filename)
                    
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2)
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({'success': True}).encode())
                    print(f"Successfully updated: {file_path}")
                except Exception as e:
                    print(f"Error writing to {filename}: {e}")
                    self.send_error(500, f"Failed to write to file: {str(e)}")
            else:
                self.send_error(400, "Invalid filename")
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

# Set the directory to serve files from (current directory)
os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
    print(f"""
🚀 mO movies Local Admin Server running (Python version)!
---------------------------------------
URL: http://localhost:{PORT}
Admin Password: 323cbc

Use this server only while adding movies. 
After saving, commit your changes to GitHub to update the live site.
    """)
    httpd.serve_forever()
