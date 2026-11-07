# thunderbird-tray

The tray program of [Tray for Thunderbird](https://github.com/kemalasliyuksek/thunderbird-tray). It works
together with the Tray for Thunderbird add-on, which it talks to through native messaging, and does
nothing on its own.

Install the wheel from the [latest release](https://github.com/kemalasliyuksek/thunderbird-tray/releases/latest),
then register it with Thunderbird:

```bash
uv tool install ./thunderbird_tray-<version>-py3-none-any.whl   # or: pipx install ./thunderbird_tray-…whl
thunderbird-tray install           # tell Thunderbird where the tray program is
thunderbird-tray status            # check the setup
```

See the [project README](https://github.com/kemalasliyuksek/thunderbird-tray#readme) for the add-on,
the features and troubleshooting.
