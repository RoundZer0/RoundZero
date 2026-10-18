import urllib.request
import json
import os
import time

MAX_TEST_CASES = 20
MAX_IO_STRING_LEN = 3500

urls = [
    'https://huggingface.co/datasets/newfacade/LeetCodeDataset/resolve/main/LeetCodeDataset-train.jsonl',
    'https://huggingface.co/datasets/newfacade/LeetCodeDataset/resolve/main/LeetCodeDataset-test.jsonl'
]

testcase_map = {}

for url in urls:
    print(f"Streaming from {url}...")
    t0 = time.time()
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    count = 0
    try:
        with urllib.request.urlopen(req) as resp:
            for line in resp:
                line_str = line.decode('utf-8').strip()
                if not line_str:
                    continue
                try:
                    raw = json.loads(line_str)
                    q_id = raw.get('question_id')
                    if not q_id or int(q_id) in testcase_map:
                        continue
                    
                    raw_io = raw.get('input_output', [])
                    formatted_io = []
                    if isinstance(raw_io, list):
                        for tc in raw_io[:MAX_TEST_CASES]:
                            if isinstance(tc, dict):
                                inp = str(tc.get('input', ''))
                                out = str(tc.get('output', ''))
                                if len(inp) <= MAX_IO_STRING_LEN and len(out) <= MAX_IO_STRING_LEN:
                                    formatted_io.append({
                                        'input': inp,
                                        'output': out
                                    })
                    
                    if formatted_io:
                        testcase_map[int(q_id)] = formatted_io
                        count += 1
                except Exception:
                    continue
        print(f"Finished {url}: processed {count} questions in {time.time()-t0:.1f}s")
    except Exception as e:
        print(f"Error reading from {url}: {e}")

output_path = os.path.join(os.path.dirname(__file__), 'extracted_testcases.json')
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(testcase_map, f)

print(f"Successfully saved {len(testcase_map)} questions with up to {MAX_TEST_CASES} test cases to {output_path}")
