# Submission

**Track:** Open Innovation · **Existing project:** No (new) · **AI tools:** Claude Code (coding assistant); Claude Haiku 4.5 (optional runtime, reads only retrieved results)

## Description (~170 words)

**Yaadon Ki Rasoi — Shazam for the taste of your childhood.** Every Indian family has a festive dish that lives only in memory: no name, no recipe. You describe it in Hinglish ("Nani ki gol mithai, gud ki smell, upar til…"); the app searches live, shows three candidate dishes with evidence, and you swipe *"Yehi hai!"*. It then reveals the dish's names across India's states (Google Trends compared by region), a heartbeat of India's searches since 2004 that peaks every Diwali (Trends time series), steps grounded in a real YouTube video's transcript (YouTube + Transcript), and old shops near you with a stranger's verbatim review line (Maps + Maps Reviews filtered by the dish). Relatives join a no-login family page; every confirmation lights a diya, and three trigger *"Teen seeti ho gayi!"*.

**SerpApi is the spine:** Google, Google Images, Trends (map + timeline), YouTube, YouTube Transcript, Maps and Maps Reviews. The LLM only reads retrieved results; anything without a source is dropped in code. Cache-first, budget-capped, with record/replay so it runs with no key.

## Checklist
- [ ] Public repo, fresh-clone replay works with no keys
- [ ] Only `.env.example` committed; secret scan clean; fixtures redacted
- [ ] Demo video < 3 min, opens in a private window
- [ ] Every engine named with its reason
- [ ] Teammates listed; rules accepted; **Submit** pressed
