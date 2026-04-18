"use client";

import { Box, type SxProps, type Theme } from "@mui/material";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

type MarkdownBlockProps = {
  content: string;
  sx?: SxProps<Theme>;
};

export function MarkdownBlock({ content, sx }: MarkdownBlockProps) {
  return (
    <Box
      sx={[
        {
          mt: 1,
          color: "inherit",
          lineHeight: 1.7,
          "& > :first-of-type": { mt: 0 },
          "& > :last-child": { mb: 0 },
          "& p": { my: 1 },
          "& ul, & ol": { pl: 3, my: 1 },
          "& li": { mb: 0.5 },
          "& code": {
            px: 0.75,
            py: 0.15,
            borderRadius: 12,
            backgroundColor: "rgba(15, 23, 42, 0.06)",
            fontFamily: '"Cascadia Code", "Consolas", monospace',
          },
          "& pre": {
            overflowX: "auto",
            my: 1,
            backgroundColor: "transparent",
          },
          "& pre > div": {
            overflow: "hidden",
            borderRadius: 3,
          },
          "& pre code": {
            p: 0,
            backgroundColor: "transparent",
          },
          "& strong": {
            fontWeight: 700,
          },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className, ...rest } = props;
            const match = /language-(\w+)/.exec(className || "");
            const code = String(children).replace(/\n$/, "");

            if (!match) {
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            }

            return (
              <SyntaxHighlighter
                // `PreTag` prevents nested pre tags because react-markdown already models the block.
                PreTag="div"
                language={match[1]}
                style={oneLight}
                customStyle={{
                  margin: 0,
                  padding: "1rem",
                  borderRadius: "12px",
                  backgroundColor: "rgba(15, 23, 42, 0.00)",
                  fontSize: "0.92rem",
                  overflowX: "auto",
                  boxSizing: "border-box",
                }}
                codeTagProps={{
                  style: {
                    fontFamily: '"Cascadia Code", "Consolas", monospace',
                  },
                }}
              >
                {code}
              </SyntaxHighlighter>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}
