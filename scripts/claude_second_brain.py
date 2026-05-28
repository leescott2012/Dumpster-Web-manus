import os
from anthropic import Anthropic

def consult_claude(prompt: str, system_message: str = "You are a highly intelligent AI assistant, acting as a strategic second brain for a product manager. Provide concise, actionable, and insightful advice.") -> str:
    """
    Consults Claude with a given prompt and system message.
    """
    client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    if not client.api_key:
        return "Error: ANTHROPIC_API_KEY environment variable not set."

    try:
        message = client.messages.create(
            model="claude-3-opus-20240229",  # Or another suitable Claude model
            max_tokens=1024,
            system=system_message,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return message.content[0].text
    except Exception as e:
        return f"Error consulting Claude: {e}"

if __name__ == "__main__":
    # Example usage:
    strategic_prompt = "Given the current state of the Dumpster web app (production-ready, payments, AI sync, bug reporting all set up), what is the single most impactful next step to accelerate user growth and retention?"
    
    print("Consulting Claude for strategic advice...")
    advice = consult_claude(strategic_prompt)
    print("\nClaude's Strategic Advice:")
    print(advice)

    # Example of a technical consultation
    technical_prompt = "I'm planning to port the web app's credit system to SwiftUI. What are the key architectural considerations for handling offline credit usage and syncing with Supabase?"
    technical_advice = consult_claude(technical_prompt, system_message="You are an expert SwiftUI and Supabase architect. Provide detailed, actionable technical advice.")
    print("\nClaude's Technical Advice:")
    print(technical_advice)
