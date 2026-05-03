"use client";

import { format, isSameDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { EmailRecord } from "./dashboard/dashboard-shared";
import sanitizeHtmlLib from "sanitize-html";

interface Props {
  emails: EmailRecord[];
  currentUserEmail: string;
}
// lib/sanitizeEmailHtml.ts

function sanitizeHtml(html: string) {
  return sanitizeHtmlLib(html, {
    allowedTags: sanitizeHtmlLib.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
      "u",
      "span",
    ]),

    allowedAttributes: {
      a: ["href", "name", "target"],
      img: ["src", "alt"],
      "*": ["style"],
    },

    allowedSchemes: ["http", "https", "mailto", "cid"],

    // Important for emails (prevents JS injection)
    disallowedTagsMode: "discard",

    transformTags: {
      a: sanitizeHtmlLib.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },

    // Strip dangerous stuff
    exclusiveFilter: (frame) => {
      return (
        frame.tag === "script" ||
        frame.tag === "style" ||
        frame.attribs?.onerror ||
        frame.attribs?.onclick
      );
    },
  });
}

export function EmailThread({ emails, currentUserEmail }: Props) {
  const sorted = [...emails].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <ScrollArea className="h-full w-full px-4 py-6">
      <div className="mx-auto space-y-6">
        {sorted.map((email, index) => {
          const prev = sorted[index - 1];
          const currentDate = parseISO(email.createdAt);
          const showDateSeparator =
            !prev || !isSameDay(parseISO(prev.createdAt), currentDate);

          const isSent =
            email.kind === "sent" ||
            email.from.toLowerCase() === currentUserEmail.toLowerCase();

          return (
            <div key={email.id}>
              {/* 📅 Date Separator */}
              {showDateSeparator && (
                <div className="flex items-center gap-4 my-6">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(currentDate, "MMMM d, yyyy")}
                  </span>
                  <Separator className="flex-1" />
                </div>
              )}

              {/* 💬 Message Row */}
              <div
                className={cn(
                  "flex items-end gap-3",
                  isSent ? "justify-end" : "justify-start",
                )}
              >
                {!isSent && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {email.from.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}

                {/* 📩 Bubble */}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm border",
                    isSent ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {/* Header */}
                  <div className="text-xs opacity-70 mb-1">
                    {isSent ? "You" : email.from}
                  </div>

                  {/* Subject (only first email or changed thread) */}
                  {index === 0 && (
                    <div className="font-medium mb-1">{email.subject}</div>
                  )}

                  {/* Body */}
                  <div className="text-sm leading-relaxed">
                    {email.htmlBody ? (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(email.htmlBody),
                        }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{email.textBody}</p>
                    )}
                  </div>

                  {/* Attachments */}
                  {email.attachments.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {email.attachments.map((file) => (
                        <a
                          key={file.id}
                          href={file.downloadPath}
                          target="_blank"
                          className="block text-xs underline"
                        >
                          📎 {file.filename}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Time */}
                  <div className="text-[10px] opacity-60 mt-2 text-right">
                    {format(currentDate, "hh:mm a")}
                  </div>
                </div>

                {isSent && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>Y</AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
