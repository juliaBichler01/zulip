import * as popovers from './popovers';
import * as user_status_ui from "./user_status_ui";
import render_mention_popover from "../templates/mention_popover.hbs";
import render_mention_popover_content from "../templates/mention_popover_content.hbs";
import {show_emoji_catalog, register_popover_events, reset_emoji_showcase,
  refill_section_head_offsets, complete_emoji_catalog} from './emoji_picker';
import * as emoji from "../shared/js/emoji";
import {initialize_compose_typeahead, get_person_suggestions} from './composebox_typeahead';

// Mention picker is of fixed width and height. Update these
// whenever these values are changed in `reactions.css`.
const APPROX_HEIGHT = 375;
const APPROX_WIDTH = 255;

let current_message_mention_popover_elem;
let mention_catalog_last_coordinates = {
  section: 0,
  index: 0,
};

const generate_mention_picker_content = function (id) {
  let emojis_used = [];

  if (id !== undefined) {
      emojis_used = reactions.get_emojis_used_by_user_for_message_id(id);
  }
  for (const emoji_dict of emoji.emojis_by_name.values()) {
      emoji_dict.has_reacted = emoji_dict.aliases.some((alias) => emojis_used.includes(alias));
  }

  const persons = get_person_suggestions('', {});

  return render_mention_popover_content({
      message_id: id,
      persons: persons,
      is_status_emoji_popover: user_status_ui.user_status_picker_open(),
  });
};

function build_mention_popover(elt, id) {
  const template_args = {
      class: "emoji-info-popover",
  };
  let placement = popovers.compute_placement(elt, APPROX_HEIGHT, APPROX_WIDTH, true);

  if (placement === "viewport_center") {
      // For legacy reasons `compute_placement` actually can
      // return `viewport_center`, but bootstrap doesn't actually
      // support that.
      placement = "left";
  }

  let template = render_mention_popover(template_args);

  // if the window is mobile sized, add the `.popover-flex` wrapper to the emoji
  // popover so that it will be wrapped in flex and centered in the screen.
  if (window.innerWidth <= 768) {
      template = "<div class='popover-flex'>" + template + "</div>";
  }

  elt.popover({
      // temporary patch for handling popover placement of `viewport_center`
      placement,
      fix_positions: true,
      template,
      title: "",
      content: generate_mention_picker_content(id),
      html: true,
      trigger: "manual",
  });
  elt.popover("show");

  initialize_compose_typeahead(".emoji-popover-filter");

  const popover = elt.data("popover").$tip;
  popover.find(".emoji-popover-filter").trigger("focus");
  current_message_mention_popover_elem = elt;

  mention_catalog_last_coordinates = {
      section: 0,
      index: 0,
  };
  show_emoji_catalog();

  elt.ready(() => refill_section_head_offsets(popover));
  register_popover_events(popover);
}

export function toggle_mention_popover(element, id) {
  const last_popover_elem = current_message_mention_popover_elem;
  popovers.hide_all();
  if (last_popover_elem !== undefined && last_popover_elem.get()[0] === element) {
      // We want it to be the case that a user can dismiss a popover
      // by clicking on the same element that caused the popover.
      return;
  }

  $(element).closest(".message_row").toggleClass("has_popover has_mention_popover");
  const elt = $(element);
  if (id !== undefined) {
      message_lists.current.select_id(id);
  }

  if (user_status_ui.user_status_picker_open()) {
      build_mention_popover(elt, id, true);
  } else if (elt.data("popover") === undefined) {
      // Keep the element over which the popover is based off visible.
      elt.addClass("reaction_button_visible");
      build_mention_popover(elt, id);
  }
  reset_emoji_showcase();
}