import feather from "feather-icons";
import npmConfig from "../package.json";

export default class ViewDataBuilder {
  public BuildViewData(): Promise<unknown> {
    return Promise.resolve({
      title: "Git 3D",
      alerts: [
        {
          level: "danger",
          icon: feather.icons["alert-octagon"].toSvg({
            "aria-label": "Danger:",
          }),
          message: "Everything's broken!",
        },
        {
          level: "warning",
          icon: feather.icons["alert-triangle"].toSvg({
            "aria-label": "Warning:",
          }),
          message: "Everything is probably broken",
        },
        {
          level: "info",
          icon: feather.icons["info"].toSvg(),
          message: "Everything should be fine",
        },
      ],
      navbar: {
        mainHeading: "Git 3D",
        optionsMenuBtnLbl: "Toggle options menu",
        optionsMenuBtnIcon: feather.icons["menu"].toSvg(),
      },
      optionsMenu: {},
      footer: {
        author: npmConfig.author.name,
      },
    });
  }
}
