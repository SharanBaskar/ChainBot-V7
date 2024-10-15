from fastapi import FastAPI
from pydantic import BaseModel
from transformers import BertTokenizer, BertForSequenceClassification
import torch

app = FastAPI()

class TextInput(BaseModel):
    text: str

tokenizer = BertTokenizer.from_pretrained('./trained_intent_model')
model = BertForSequenceClassification.from_pretrained('./trained_intent_model')

@app.post("/predict")
def predict(input: TextInput):
    inputs = tokenizer(input.text, return_tensors="pt", truncation=True, padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
        prediction = torch.argmax(outputs.logits, dim=1).item()
    return {"prediction": prediction}
