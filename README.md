# AI Agent

```bash
ollama pull qwen2.5:7b
ollama pull qwen2.5-coder:7
ollama pull nomic-embed-text

ollama serve
```

.git/hooks/pre-commit

```bash
#!/bin/bash
echo "Formatting main project..."
mvn fmt:format -q

if [ $? -ne 0 ]; then
  echo "main project formatting failed!"
  exit 1
fi

echo "Formatting mcp-server..."
cd ./mcp-server
mvn fmt:format -q
FORMAT_RESULT=$?
cd ..

if [ $FORMAT_RESULT -ne 0 ]; then
  echo "mcp-server formatting failed!"
  exit 1
fi

git diff --name-only --cached -- '*.java' | xargs -r git add

echo "Code formatted successfully!"
exit 0
```
