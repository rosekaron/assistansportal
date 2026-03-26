# What Are "Skills" in Claude — And Why They're Kind of a Big Deal

*Posted to my blog — March 2026*

---

I've been building a software application by talking to Claude. No coding background, just conversations. And recently I discovered something that changed how I think about what Claude actually is.

It's called Skills.

---

## The problem with starting from scratch

Every time you start a new conversation with Claude, it starts fresh. It doesn't remember the last time you asked it to help you write a blog post, or the specific way you like your code formatted, or the fact that you always want Word documents with a specific header style.

So people found a workaround: paste a big block of instructions at the start of every conversation. *"When I ask you to write a document, always do X, Y, Z."* It works, but it's annoying and easy to forget.

Skills are the proper solution to this.

---

## What a skill actually is

A skill is a text file — specifically a Markdown file called `SKILL.md` — that lives in a special folder Claude has access to. When you ask Claude to do something that matches the skill's description, Claude automatically reads the file and follows its instructions.

That's it. No code. No complicated setup. Just a well-written text file that tells Claude exactly how to do a specific task really well.

Here's what makes that powerful: a skill can contain everything Claude needs to be an expert at that task. Not just instructions, but context, examples, gotchas to avoid, templates to use, scripts to run. A skill for creating Word documents might include the exact library to use, the correct way to set fonts and margins, how to handle tables — all the stuff you'd otherwise have to explain from scratch every single time.

---

## The skills I discovered in my project

When I started building my app, I noticed Claude had access to a folder of skills without me setting them up. There was one for creating Word documents, one for Excel spreadsheets, one for PowerPoint presentations, one for reading PDFs.

Each of these is a carefully written guide — sometimes hundreds of lines — that condenses the best way to do a specific task. When I ask Claude to make a Word document, it reads the Word skill first, follows its guidance, and produces something that actually looks professional instead of a generic output.

What I found even more interesting was a skill called "skill-creator" — a skill for *making new skills*. Meta, right? It walks Claude through a whole process: figure out what the skill should do, write a draft, test it with sample prompts, evaluate the results, iterate until it works well. Like a software development loop, but for teaching Claude new abilities.

---

## The first skill I created myself

In my project, there's already a skill for writing vibe-coding blog posts — capturing a specific tone, structure, and style. I wrote it myself, after someone in my network who is further along on this journey suggested I try it.

That felt significant: the first skill I created wasn't something I invented — it was knowledge passed to me by someone else, that I then encoded so Claude could use it. Like being taught a recipe and then writing it down for the next person.

And now every time I ask Claude to write a blog post about building apps, it reaches for that skill automatically. The style is just there, waiting, without me having to explain it again.

---

## What this changes

Before I understood skills, I thought of Claude as a very smart assistant that I had to re-explain everything to each time. Now I think of it differently.

Skills mean that Claude can be *trained* — not in the neural network sense, but in the practical sense. You can teach it your company's document style. Your team's coding conventions. The specific quirks of whatever industry you work in. You write it down once, save it as a skill, and Claude knows it every time from then on.

---

## The bigger idea

What skills really represent is a way to give Claude *institutional knowledge*.

If an expert at a specific domain wanted to teach Claude exactly how to handle every edge case in their field — the rules, the common mistakes, the things that aren't written down anywhere — they could write that down as a skill. And from that point on, every conversation that touches that domain would benefit from that expertise automatically.

That's not a small thing. That's the difference between a general-purpose AI and one that actually knows your world.

I'm still figuring out how to use this properly. But I've started thinking about what I would put in my own skills — the context Claude always needs about my projects, the patterns we've worked out together over months of conversations.

Somewhere in that folder is a blank SKILL.md with my name on it. I'm getting closer to filling it in.

---

*Rose Karon writes about parenting, care, and figuring things out one conversation at a time.*
