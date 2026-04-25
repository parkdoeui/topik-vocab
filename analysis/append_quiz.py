import json
import sys
import os

FILE_PATH = 'src/data/vocabs/quiz-sentences.json'

def append_quiz_data(new_data):
    if os.path.exists(FILE_PATH):
        with open(FILE_PATH, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = {}
    else:
        data = {}
    
    data.update(new_data)
    
    with open(FILE_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Quiz sentences now has {len(data)} words.")

if __name__ == '__main__':
    # Read json from stdin
    new_data = json.load(sys.stdin)
    append_quiz_data(new_data)
