from google import genai

client = genai.Client(
    vertexai=True, 
    project="project-d778e3ac-55b5-4b70-8dc", 
    location="us-central1"
)

response = client.models.generate_content(
    model="gemini-2.5-flash", 
    contents="Say hello in Korean."
)

print(f"Response: {response.text}")
