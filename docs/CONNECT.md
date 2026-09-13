# Telegate Connect for Mac

Your desk, on call. Keep Connect running on the Mac that will do the work, then send ideas from Telegate on your phone.

1. Open **Settings**. Name your computer and enter your relay’s HTTPS service address. Use that same address when signing into the phone app. The relay must already be running; Connect does not host it for you.
2. Under **Add an agent**, choose Codex, Claude Code, OpenClaw, Hermes Agent, Grok Bot, or Other agent. Local agents use their existing installation and login. Choose a project folder and optionally share its metadata with voice. Grok Bot and other cloud services need their connection URL and key.
3. Click **Pair my phone**. On your phone, open **Computers → Add computer**, enter the code, and confirm this Mac’s name. Pairing codes expire after ten minutes. Copy buttons let you copy the code and service address separately.
4. Leave Connect open and your Mac awake. The phone’s computer status confirms the relay is receiving heartbeats. **Pause connection** stops the local connector; pause before changing agent settings.

**Configure** opens one agent’s settings. Changes apply only when saved; Cancel leaves the current configuration intact. Executable paths, custom arguments, OpenClaw agent selection and time limits are under **Advanced settings**. Removing an agent removes its Connect entry; it does not uninstall the agent.

**Open at login** starts the app at login. **Activity** shows connector details for troubleshooting.

## If pairing cannot reach the server

- Verify your relay is running and its `/health` endpoint responds over HTTPS.
- `127.0.0.1` and `localhost` mean the device you are using. An iPhone cannot reach your Mac through its own localhost address.
- Use one reachable HTTPS service address on both devices.
- A temporary tunnel is suitable for a development check. Keep its relay and tunnel processes running. The hostname may change after a tunnel restart; use a stable host for ongoing use. See [self-hosting](SELF-HOST.md).

Icons identify the available integrations. Selecting an agent does not install it or prove its credentials work. See [icon sources and licenses](HARNESS-ICON-NOTICES.md).
