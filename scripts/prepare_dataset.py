import urllib.request
import json
import os
import re

def clean_title(task_id, q_id):
    if not task_id:
        return f"Question {q_id}"
    # Replace dashes/underscores with spaces
    title = task_id.replace('-', ' ').replace('_', ' ')
    # Capitalize words
    words = [w.capitalize() if not w.isupper() else w for w in title.split()]
    title = ' '.join(words)
    return title

def parse_dataset():
    urls = [
        'https://huggingface.co/datasets/newfacade/LeetCodeDataset/resolve/main/LeetCodeDataset-train.jsonl',
        'https://huggingface.co/datasets/newfacade/LeetCodeDataset/resolve/main/LeetCodeDataset-test.jsonl'
    ]
    
    questions = []
    seen_ids = set()
    
    for url in urls:
        print(f"Downloading from {url}...")
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            with urllib.request.urlopen(req) as resp:
                for line in resp:
                    if not line.strip():
                        continue
                    try:
                        raw = json.loads(line.decode('utf-8'))
                        q_id = raw.get('question_id')
                        if not q_id or q_id in seen_ids:
                            continue
                        seen_ids.add(q_id)
                        
                        diff = raw.get('difficulty', 'Medium')
                        if not diff or diff not in ['Easy', 'Medium', 'Hard']:
                            diff = 'Medium'
                            
                        tags = raw.get('tags', [])
                        if not isinstance(tags, list):
                            tags = []
                        # Clean tags
                        tags = [t.strip() for t in tags if t and isinstance(t, str)]
                        if not tags:
                            tags = ['Algorithms']
                            
                        task_id = raw.get('task_id', '')
                        title = clean_title(task_id, q_id)
                        
                        points = 100 if diff == 'Easy' else (200 if diff == 'Medium' else 400)
                        
                        desc = raw.get('problem_description', '') or raw.get('prompt', '') or "No description provided."
                        starter = raw.get('starter_code', '') or f"class Solution:\n    def solve(self):\n        # Write your solution here\n        pass"
                        
                        input_output = raw.get('input_output', [])
                        formatted_io = []
                        if isinstance(input_output, list):
                            for io in input_output[:20]:  # Keep up to 20 comprehensive test cases
                                if isinstance(io, dict):
                                    formatted_io.append({
                                        'input': str(io.get('input', '')),
                                        'output': str(io.get('output', ''))
                                    })
                        
                        questions.append({
                            'id': int(q_id),
                            'taskId': task_id,
                            'title': title,
                            'difficulty': diff,
                            'points': points,
                            'tags': tags,
                            'problemDescription': desc,
                            'starterCode': starter,
                            'entryPoint': raw.get('entry_point', ''),
                            'inputOutput': formatted_io
                        })
                    except Exception as e:
                        continue
        except Exception as e:
            print(f"Error fetching {url}: {e}")

    # Sort questions by ID
    questions.sort(key=lambda x: x['id'])
    print(f"Total processed questions: {len(questions)}")
    
    # Save to src/data/questions.json and public/data/questions.json
    os.makedirs('src/data', exist_ok=True)
    os.makedirs('public/data', exist_ok=True)
    
    output_path = 'src/data/questions.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)
    print(f"Saved dataset to {output_path}")

    public_output_path = 'public/data/questions.json'
    with open(public_output_path, 'w', encoding='utf-8') as f:
        json.dump(questions, f, ensure_ascii=False)
    print(f"Saved dataset to {public_output_path}")

if __name__ == '__main__':
    parse_dataset()
